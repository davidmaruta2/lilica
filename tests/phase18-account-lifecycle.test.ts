// Phase 18: client-side coverage for account-deletion eligibility and
// data export. The real authorisation/filtering invariants are enforced
// server-side and covered by
// supabase/tests/database/phase18_privacy_export.test.sql -- this file
// only proves the client wraps those calls correctly. Profile display-
// name editing is NOT covered here -- it reuses AuthProvider's existing,
// already-tested `saveProfile()` (see tests/auth-provider.test.tsx).

const mockRpc = jest.fn();
jest.mock('../src/auth/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

const mockWrite = jest.fn();
jest.mock('expo-file-system', () => ({
  File: class {
    uri = 'file:///cache/export.json';
    write = (...args: unknown[]) => mockWrite(...args);
  },
  Paths: { cache: 'mock-cache-root' },
}));

const mockSharingAvailable = jest.fn(() => true);
const mockShareAsync = jest.fn();
jest.mock('expo-sharing', () => ({
  isAvailableAsync: async () => mockSharingAvailable(),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

import { checkAccountDeletionEligibility, exportMyData } from '../src/accountLifecycle';

beforeEach(() => {
  jest.clearAllMocks();
  mockSharingAvailable.mockReturnValue(true);
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

describe('exportMyData', () => {
  it('writes the server\'s export to a local file and shares it -- never uploads it anywhere', async () => {
    mockRpc.mockResolvedValue({ data: { profile: {}, careSpaces: [] }, error: null });
    const result = await exportMyData();
    expect(mockRpc).toHaveBeenCalledWith('export_my_data');
    expect(mockWrite).toHaveBeenCalledWith(JSON.stringify({ profile: {}, careSpaces: [] }, null, 2));
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/export.json', { mimeType: 'application/json' });
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('fails gracefully when the server call fails, never throws', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
    const result = await exportMyData();
    expect(result.ok).toBe(false);
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('fails gracefully when sharing is unavailable on this device', async () => {
    mockRpc.mockResolvedValue({ data: {}, error: null });
    mockSharingAvailable.mockReturnValue(false);
    const result = await exportMyData();
    expect(result.ok).toBe(false);
  });
});
