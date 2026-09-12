// Phase 18: the durable document-cleanup queue that closes the gap Phase
// 17 explicitly left open -- an offline (or otherwise failed) document
// deletion must not permanently strand its cloud attachment bytes/links.

const mockRpc = jest.fn();
const mockRemove = jest.fn();
jest.mock('../src/auth/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: { from: () => ({ remove: (...args: unknown[]) => mockRemove(...args) }) },
  },
}));

const mockRemoveAllLinksForRecord = jest.fn();
jest.mock('../src/recordLinks', () => ({
  removeAllLinksForRecord: (...args: unknown[]) => mockRemoveAllLinksForRecord(...args),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  enqueueDocumentCleanup,
  hasPendingDocumentCleanup,
  retryPendingDocumentCleanup,
} from '../src/documentCleanupQueue';
import { LilicaRecord } from '../src/types';

const ownerId = 'owner-1';

const document: LilicaRecord = {
  id: 'doc-1', type: 'document', title: 'Hospital appointment letter', status: 'saved',
  createdAt: '2026-09-12T00:00:00.000Z',
  attachments: [{ id: 'att-1', kind: 'file', name: 'letter.pdf', storageObjectPath: 'space-1/doc-1/att-1-letter.pdf', uploadStatus: 'uploaded', createdAt: '2026-09-12T00:00:00.000Z' }],
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('enqueueDocumentCleanup', () => {
  it('is a no-op for a non-document record', async () => {
    await enqueueDocumentCleanup(ownerId, { ...document, type: 'task' });
    expect(await hasPendingDocumentCleanup(ownerId)).toBe(false);
  });

  it('durably records the deletion before any network attempt', async () => {
    await enqueueDocumentCleanup(ownerId, document);
    expect(await hasPendingDocumentCleanup(ownerId)).toBe(true);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('is idempotent -- enqueuing the same record twice does not duplicate the entry', async () => {
    await enqueueDocumentCleanup(ownerId, document);
    await enqueueDocumentCleanup(ownerId, document);
    mockRpc.mockResolvedValue({ error: null });
    mockRemove.mockResolvedValue({ error: null });
    mockRemoveAllLinksForRecord.mockResolvedValue(undefined);
    await retryPendingDocumentCleanup(ownerId);
    // Exactly one attachment's worth of cleanup, not two.
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemoveAllLinksForRecord).toHaveBeenCalledTimes(1);
  });
});

describe('retryPendingDocumentCleanup', () => {
  it('removes the Storage object, tombstones attachment metadata, and tombstones links -- then clears the queue entry', async () => {
    await enqueueDocumentCleanup(ownerId, document);
    mockRemove.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ error: null });
    mockRemoveAllLinksForRecord.mockResolvedValue(undefined);

    await retryPendingDocumentCleanup(ownerId);

    expect(mockRemove).toHaveBeenCalledWith(['space-1/doc-1/att-1-letter.pdf']);
    expect(mockRpc).toHaveBeenCalledWith('remove_record_attachment', { target_attachment_id: 'att-1' });
    expect(mockRemoveAllLinksForRecord).toHaveBeenCalledWith('doc-1');
    expect(await hasPendingDocumentCleanup(ownerId)).toBe(false);
  });

  it('leaves a failed cleanup queued for the next retry -- never silently drops it', async () => {
    await enqueueDocumentCleanup(ownerId, document);
    mockRemove.mockRejectedValue(new Error('offline'));

    await retryPendingDocumentCleanup(ownerId);
    expect(await hasPendingDocumentCleanup(ownerId)).toBe(true);

    // Reconnect: the second attempt succeeds and the queue finally clears.
    mockRemove.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ error: null });
    mockRemoveAllLinksForRecord.mockResolvedValue(undefined);
    await retryPendingDocumentCleanup(ownerId);
    expect(await hasPendingDocumentCleanup(ownerId)).toBe(false);
  });

  it('is a safe no-op when the queue is empty', async () => {
    await expect(retryPendingDocumentCleanup(ownerId)).resolves.toBeUndefined();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('skips the Storage removal for an attachment that never actually uploaded, but still tombstones its metadata and the record\'s links', async () => {
    const neverUploaded: LilicaRecord = {
      ...document,
      attachments: [{ ...document.attachments![0], storageObjectPath: undefined, uploadStatus: undefined }],
    };
    await enqueueDocumentCleanup(ownerId, neverUploaded);
    mockRpc.mockResolvedValue({ error: null });
    mockRemoveAllLinksForRecord.mockResolvedValue(undefined);

    await retryPendingDocumentCleanup(ownerId);
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith('remove_record_attachment', { target_attachment_id: 'att-1' });
    expect(await hasPendingDocumentCleanup(ownerId)).toBe(false);
  });

  it('a restart (fresh module state, same AsyncStorage) still finds and retries the pending entry', async () => {
    await enqueueDocumentCleanup(ownerId, document);
    // Simulate "app restart" by re-reading straight from AsyncStorage via
    // a second call, with no in-memory state carried over (this module
    // holds no in-memory state at all -- every call reads AsyncStorage
    // fresh -- so this is really just confirming that property directly).
    mockRemove.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ error: null });
    mockRemoveAllLinksForRecord.mockResolvedValue(undefined);
    await retryPendingDocumentCleanup(ownerId);
    expect(await hasPendingDocumentCleanup(ownerId)).toBe(false);
  });
});
