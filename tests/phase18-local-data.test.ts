// Phase 18: "Device & local data" mechanics -- what counts as pending
// local work worth warning about, and that clearing removes only local
// state.

const mockHasPendingDocumentCleanup = jest.fn();
jest.mock('../src/documentCleanupQueue', () => ({
  hasPendingDocumentCleanup: (...args: unknown[]) => mockHasPendingDocumentCleanup(...args),
}));

const mockReadRecordCache = jest.fn();
jest.mock('../src/recordSync', () => ({
  readRecordCache: (...args: unknown[]) => mockReadRecordCache(...args),
}));

const mockDelete = jest.fn();
jest.mock('expo-file-system', () => ({
  Directory: class {
    delete = (...args: unknown[]) => mockDelete(...args);
  },
  Paths: { document: 'mock-document-root', cache: 'mock-cache-root' },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearLocalDataForOwner, hasUnuploadedAttachment, pendingLocalWork } from '../src/localData';
import { LilicaRecord } from '../src/types';

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockHasPendingDocumentCleanup.mockResolvedValue(false);
  mockReadRecordCache.mockResolvedValue({ spaces: {} });
});

describe('hasUnuploadedAttachment', () => {
  const document: LilicaRecord = {
    id: 'doc-1', type: 'document', title: 'Letter', status: 'saved', createdAt: '2026-09-12T00:00:00.000Z',
  };

  it('is false when there are no documents', () => {
    expect(hasUnuploadedAttachment([{ id: 'task-1', type: 'task', title: 'x', status: 'unresolved', createdAt: '2026-09-12T00:00:00.000Z' }])).toBe(false);
  });

  it('is true for a document with a local file not yet uploaded', () => {
    const record = { ...document, attachments: [{ id: 'a', kind: 'file' as const, name: 'x.pdf', uri: 'file:///x.pdf', createdAt: '2026-09-12T00:00:00.000Z' }] };
    expect(hasUnuploadedAttachment([record])).toBe(true);
  });

  it('is false once every attachment is confirmed uploaded', () => {
    const record = { ...document, attachments: [{ id: 'a', kind: 'file' as const, name: 'x.pdf', uri: 'file:///x.pdf', uploadStatus: 'uploaded' as const, createdAt: '2026-09-12T00:00:00.000Z' }] };
    expect(hasUnuploadedAttachment([record])).toBe(false);
  });
});

describe('pendingLocalWork', () => {
  it('reports no pending work when the cache/queue are both clean', async () => {
    const result = await pendingLocalWork('owner-1', []);
    expect(result).toEqual({ hasPendingMutations: false, hasPendingUploads: false, hasPendingCleanup: false });
  });

  it('reports a pending mutation when any care space still has a non-empty outbox', async () => {
    mockReadRecordCache.mockResolvedValue({ spaces: { 'space-1': { outbox: [{ id: 'm-1' }] } } });
    const result = await pendingLocalWork('owner-1', []);
    expect(result.hasPendingMutations).toBe(true);
  });

  it('reports a pending upload from the records passed in', async () => {
    const record: LilicaRecord = {
      id: 'doc-1', type: 'document', title: 'Letter', status: 'saved', createdAt: '2026-09-12T00:00:00.000Z',
      attachments: [{ id: 'a', kind: 'file', name: 'x.pdf', uri: 'file:///x.pdf', createdAt: '2026-09-12T00:00:00.000Z' }],
    };
    const result = await pendingLocalWork('owner-1', [record]);
    expect(result.hasPendingUploads).toBe(true);
  });

  it('reports pending cleanup straight from the durable cleanup queue', async () => {
    mockHasPendingDocumentCleanup.mockResolvedValue(true);
    const result = await pendingLocalWork('owner-1', []);
    expect(result.hasPendingCleanup).toBe(true);
  });
});

describe('clearLocalDataForOwner', () => {
  it('removes this owner\'s local AsyncStorage state and local attachment directories, nothing cloud-side', async () => {
    await AsyncStorage.setItem('lilica:record-cache:v1:owner-1', '{}');
    await AsyncStorage.setItem('lilica:onboarding:v1:owner-1', '{}');
    await AsyncStorage.setItem('lilica:record-cache:v1:owner-2', 'untouched');

    await clearLocalDataForOwner('owner-1');

    expect(await AsyncStorage.getItem('lilica:record-cache:v1:owner-1')).toBeNull();
    expect(await AsyncStorage.getItem('lilica:onboarding:v1:owner-1')).toBeNull();
    expect(await AsyncStorage.getItem('lilica:record-cache:v1:owner-2')).toBe('untouched');
    expect(mockDelete).toHaveBeenCalledTimes(2); // attachments dir + preview cache dir
  });

  it('never throws when there is nothing local to clear', async () => {
    mockDelete.mockImplementation(() => { throw new Error('ENOENT'); });
    await expect(clearLocalDataForOwner('owner-1')).resolves.toBeUndefined();
  });
});
