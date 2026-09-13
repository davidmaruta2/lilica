// Phase 18/18B: client-side coverage for account-deletion eligibility,
// real account deletion, and data export (including actual document
// files). The real authorisation/filtering/lifecycle invariants are
// enforced server-side and covered by
// supabase/tests/database/phase18_privacy_export.test.sql and
// supabase/tests/database/phase18b_account_deletion.test.sql -- this file
// only proves the client wraps those calls correctly. Profile display-
// name editing is NOT covered here -- it reuses AuthProvider's existing,
// already-tested `saveProfile()` (see tests/auth-provider.test.tsx).

const mockRpc = jest.fn();
const mockAttachmentSelect = jest.fn();
const mockCreateSignedUrl = jest.fn();
jest.mock('../src/auth/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: (...args: unknown[]) => mockAttachmentSelect(...args),
        }),
      }),
    }),
    storage: {
      from: () => ({
        createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
      }),
    },
  },
}));

const mockWrite = jest.fn();
const mockDirectoryCreate = jest.fn();
const mockDownloadFileAsync = jest.fn();
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    write = (...args: unknown[]) => mockWrite(...args);
    constructor(...parts: unknown[]) {
      this.uri = `file:///${parts.filter((part) => typeof part === 'string').join('/')}`;
    }
    static downloadFileAsync(...args: unknown[]) { return mockDownloadFileAsync(...args); }
  },
  Directory: class {
    create = (...args: unknown[]) => mockDirectoryCreate(...args);
    constructor(..._parts: unknown[]) {}
  },
  Paths: { cache: 'mock-cache-root' },
}));

const mockSharingAvailable = jest.fn(() => true);
const mockShareAsync = jest.fn();
jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => mockSharingAvailable(),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

import { checkAccountDeletionEligibility, deleteMyAccount, exportMyData, shareExportFile } from '../src/accountLifecycle';

beforeEach(() => {
  jest.clearAllMocks();
  mockSharingAvailable.mockReturnValue(true);
  mockDownloadFileAsync.mockResolvedValue({ uri: 'file:///cache/downloaded.pdf' });
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/file' }, error: null });
  mockAttachmentSelect.mockResolvedValue({ data: { storage_object_path: 'space-1/record-1/file.pdf' } });
});

describe('checkAccountDeletionEligibility', () => {
  it('returns only the blocking care spaces, never the non-blocking ones', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { care_space_id: 'space-1', care_space_name: 'Beauty', blocking: true },
        { care_space_id: 'space-2', care_space_name: 'Jackie', blocking: false },
      ],
      error: null,
    });
    const result = await checkAccountDeletionEligibility();
    expect(result).toEqual({ ok: true, data: [{ careSpaceId: 'space-1', careSpaceName: 'Beauty' }] });
  });

  it('an unblocked account (no sole-organiser spaces) returns an empty list', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    const result = await checkAccountDeletionEligibility();
    expect(result).toEqual({ ok: true, data: [] });
  });
});

describe('deleteMyAccount', () => {
  it('calls the real RPC and succeeds when it does', async () => {
    mockRpc.mockResolvedValue({ error: null });
    const result = await deleteMyAccount();
    expect(mockRpc).toHaveBeenCalledWith('delete_my_account');
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('surfaces the real sole-organiser blocker message verbatim, never a generic one', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'Cannot delete account: Beauty still depends on you as its only organiser. Appoint another organiser first.' } });
    const result = await deleteMyAccount();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('Beauty still depends on you');
  });

  it('fails gracefully on an unrelated server error, never throws', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'Network request failed' } });
    const result = await deleteMyAccount();
    expect(result.ok).toBe(false);
  });
});

describe('exportMyData', () => {
  it('writes data.json even with no care spaces, and never attempts a document download', async () => {
    mockRpc.mockResolvedValue({ data: { profile: {}, careSpaces: [] }, error: null });
    const result = await exportMyData();
    expect(mockRpc).toHaveBeenCalledWith('export_my_data');
    expect(mockAttachmentSelect).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.files.map((file) => file.label)).toEqual(['data.json']);
      expect(result.data.skippedDocuments).toBe(0);
    }
  });

  it('downloads an authorised, uploaded document and includes it in the file list and data.json', async () => {
    mockRpc.mockResolvedValue({
      data: {
        careSpaces: [{
          careSpaceName: 'Beauty',
          attachments: [{ id: 'att-1', recordId: 'rec-1', displayName: 'Hospital letter.pdf', mimeType: 'application/pdf', uploadStatus: 'uploaded' }],
        }],
      },
      error: null,
    });
    const result = await exportMyData();
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('space-1/record-1/file.pdf', expect.any(Number));
    expect(mockDownloadFileAsync).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.files.some((file) => file.label.includes('Hospital letter.pdf'))).toBe(true);
      expect(result.data.skippedDocuments).toBe(0);
    }
    const written = JSON.parse(mockWrite.mock.calls[0][0] as string);
    const writtenAttachment = written.careSpaces[0].attachments[0];
    expect(writtenAttachment.fileAvailable).toBe(true);
    expect(writtenAttachment.exportPath).toBe('documents/Beauty/Hospital letter.pdf');
    expect(writtenAttachment).not.toHaveProperty('storageObjectPath');
  });

  it('never authoritatively trusts a stale local copy -- always re-downloads from the current cloud file', async () => {
    mockRpc.mockResolvedValue({
      data: { careSpaces: [{ careSpaceName: 'Beauty', attachments: [{ id: 'att-1', recordId: 'rec-1', displayName: 'letter.pdf', uploadStatus: 'uploaded' }] }] },
      error: null,
    });
    await exportMyData();
    // Every included file's bytes come from a fresh signed URL against the
    // server's own storage_object_path -- never a device-local uri.
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
    expect(mockDownloadFileAsync).toHaveBeenCalledTimes(1);
  });

  it('a legacy attachment that never finished uploading is skipped, not fabricated, and does not abort the export', async () => {
    mockRpc.mockResolvedValue({
      data: { careSpaces: [{ careSpaceName: 'Beauty', attachments: [{ id: 'att-1', recordId: 'rec-1', displayName: 'letter.pdf', uploadStatus: 'pending' }] }] },
      error: null,
    });
    const result = await exportMyData();
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.skippedDocuments).toBe(1);
    const written = JSON.parse(mockWrite.mock.calls[0][0] as string);
    expect(written.careSpaces[0].attachments[0].fileAvailable).toBe(false);
  });

  it('a download failure for one document is truthfully marked unavailable, not fatal to the rest of the export', async () => {
    mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    mockRpc.mockResolvedValue({
      data: { careSpaces: [{ careSpaceName: 'Beauty', attachments: [{ id: 'att-1', recordId: 'rec-1', displayName: 'letter.pdf', uploadStatus: 'uploaded' }] }] },
      error: null,
    });
    const result = await exportMyData();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.skippedDocuments).toBe(1);
  });

  it('two documents with the same filename in the same care space both survive, safely renamed', async () => {
    mockRpc.mockResolvedValue({
      data: {
        careSpaces: [{
          careSpaceName: 'Beauty',
          attachments: [
            { id: 'att-1', recordId: 'rec-1', displayName: 'letter.pdf', uploadStatus: 'uploaded' },
            { id: 'att-2', recordId: 'rec-2', displayName: 'letter.pdf', uploadStatus: 'uploaded' },
          ],
        }],
      },
      error: null,
    });
    const result = await exportMyData();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const names = result.data.files.map((file) => file.label);
      expect(new Set(names).size).toBe(names.length); // no collision
    }
  });

  it('fails gracefully when the server call fails, never throws', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
    const result = await exportMyData();
    expect(result.ok).toBe(false);
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });
});

describe('shareExportFile', () => {
  it('shares the given file via the native share sheet', async () => {
    const result = await shareExportFile({ label: 'data.json', uri: 'file:///cache/data.json', mimeType: 'application/json' });
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/data.json', { mimeType: 'application/json' });
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('fails gracefully when sharing is unavailable on this device', async () => {
    mockSharingAvailable.mockReturnValue(false);
    const result = await shareExportFile({ label: 'data.json', uri: 'file:///cache/data.json' });
    expect(result.ok).toBe(false);
  });
});
