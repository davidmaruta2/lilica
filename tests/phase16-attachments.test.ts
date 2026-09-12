// Phase 16: client-side coverage for cloud attachment upload/retrieval.
// The real permission boundary (documents-domain read/write, RLS on
// storage.objects) is enforced server-side and covered by
// supabase/tests/database/phase16_document_maturity.test.sql -- this file
// proves the upload/view orchestration itself: never marking an
// attachment "uploaded" before it genuinely is, and never crashing on a
// missing/undownloadable file.

const mockRpc = jest.fn();
const mockUpload = jest.fn();
const mockCreateSignedUrl = jest.fn();

jest.mock('../src/auth/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: { from: () => ({ upload: (...args: unknown[]) => mockUpload(...args), createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args) }) },
  },
}));

const mockFileExists = jest.fn(() => true);
const mockDownloadFileAsync = jest.fn();
const mockDirectoryCreate = jest.fn();

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = String(parts[parts.length - 1]); }
    get exists() { return mockFileExists(); }
    static downloadFileAsync = (...args: unknown[]) => mockDownloadFileAsync(...args);
  }
  class MockDirectory {
    constructor(..._parts: unknown[]) {}
    create = (...args: unknown[]) => mockDirectoryCreate(...args);
  }
  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: { cache: 'mock-cache-root', document: 'mock-document-root' },
  };
});

const mockSharingAvailable = jest.fn(() => true);
const mockShareAsync = jest.fn();
jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => mockSharingAvailable(),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

import { attachmentStoragePath, openAttachment, queuePendingAttachmentUploads } from '../src/attachments';
import { LilicaRecord, RecordAttachment } from '../src/types';

const baseAttachment: RecordAttachment = {
  id: 'att-1', kind: 'file', name: 'hospital letter.pdf', uri: 'file:///local/hospital-letter.pdf',
  mimeType: 'application/pdf', size: 1024, createdAt: '2026-09-12T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFileExists.mockReturnValue(true);
  mockSharingAvailable.mockReturnValue(true);
});

describe('attachmentStoragePath', () => {
  it('is deterministic and built only from stable IDs, never a display name', () => {
    const path = attachmentStoragePath('space-1', 'record-1', baseAttachment);
    expect(path).toBe('space-1/record-1/att-1-hospital_letter.pdf');
  });
});

describe('queuePendingAttachmentUploads', () => {
  const document: LilicaRecord = {
    id: 'doc-1', type: 'document', title: 'Hospital letter', status: 'saved',
    createdAt: '2026-09-12T00:00:00.000Z', attachments: [baseAttachment],
  };

  it('is a no-op for non-document records', async () => {
    const result = await queuePendingAttachmentUploads('space-1', { ...document, type: 'task' });
    expect(result).toBeUndefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('is a no-op when there is nothing to upload', async () => {
    const result = await queuePendingAttachmentUploads('space-1', { ...document, attachments: [] });
    expect(result).toBeUndefined();
  });

  it('skips an attachment already marked uploaded', async () => {
    const result = await queuePendingAttachmentUploads('space-1', {
      ...document, attachments: [{ ...baseAttachment, uploadStatus: 'uploaded' }],
    });
    expect(result).toBeUndefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('persists metadata, uploads bytes, then marks uploaded -- only once the transfer genuinely succeeds', async () => {
    mockRpc.mockResolvedValue({ error: null });
    mockUpload.mockResolvedValue({ error: null });
    const [result] = (await queuePendingAttachmentUploads('space-1', document))!;
    expect(mockRpc).toHaveBeenNthCalledWith(1, 'upsert_record_attachment', expect.objectContaining({
      attachment_id: 'att-1', target_record_id: 'doc-1', target_care_space_id: 'space-1',
    }));
    expect(mockUpload).toHaveBeenCalledWith(
      'space-1/doc-1/att-1-hospital_letter.pdf',
      expect.anything(),
      expect.objectContaining({ contentType: 'application/pdf' }),
    );
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'mark_attachment_upload_status', {
      target_attachment_id: 'att-1', new_status: 'uploaded',
    });
    expect(result.uploadStatus).toBe('uploaded');
    expect(result.storageObjectPath).toBe('space-1/doc-1/att-1-hospital_letter.pdf');
  });

  it('never marks an attachment uploaded when the byte transfer fails', async () => {
    mockRpc.mockResolvedValueOnce({ error: null }); // metadata upsert succeeds
    mockUpload.mockResolvedValue({ error: { message: 'network down' } });
    const [result] = (await queuePendingAttachmentUploads('space-1', document))!;
    expect(result.uploadStatus).not.toBe('uploaded');
    expect(mockRpc).toHaveBeenCalledTimes(1); // mark_attachment_upload_status never called
  });

  it('never marks an attachment uploaded when the metadata call itself fails', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'offline' } });
    const [result] = (await queuePendingAttachmentUploads('space-1', document))!;
    expect(result.uploadStatus).not.toBe('uploaded');
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe('openAttachment', () => {
  it('shares the local copy directly when this device already has one', async () => {
    const result = await openAttachment(baseAttachment);
    expect(result).toEqual({ ok: true });
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    expect(mockShareAsync).toHaveBeenCalledWith(baseAttachment.uri, { mimeType: 'application/pdf' });
  });

  it('downloads via a short-lived signed URL when no local copy exists', async () => {
    mockFileExists.mockReturnValue(false);
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/att-1' }, error: null });
    mockDownloadFileAsync.mockResolvedValue({ uri: 'file:///cache/att-1-hospital_letter.pdf' });
    const cloudOnly: RecordAttachment = { ...baseAttachment, uri: undefined, storageObjectPath: 'space-1/doc-1/att-1-hospital_letter.pdf' };
    const result = await openAttachment(cloudOnly);
    expect(result).toEqual({ ok: true });
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('space-1/doc-1/att-1-hospital_letter.pdf', expect.any(Number));
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/att-1-hospital_letter.pdf', { mimeType: 'application/pdf' });
  });

  it('never marks an attachment safely viewable when it has neither a local copy nor a cloud path yet', async () => {
    const stillUploading: RecordAttachment = { ...baseAttachment, uri: undefined, storageObjectPath: undefined };
    const result = await openAttachment(stillUploading);
    expect(result.ok).toBe(false);
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('fails gracefully, never throws, when the signed URL request fails', async () => {
    mockFileExists.mockReturnValue(false);
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'offline' } });
    const cloudOnly: RecordAttachment = { ...baseAttachment, uri: undefined, storageObjectPath: 'space-1/doc-1/att-1.pdf' };
    const result = await openAttachment(cloudOnly);
    expect(result.ok).toBe(false);
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('fails gracefully when native sharing is unavailable on this device', async () => {
    mockSharingAvailable.mockReturnValue(false);
    const result = await openAttachment(baseAttachment);
    expect(result.ok).toBe(false);
  });
});
