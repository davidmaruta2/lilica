// Remove-supported-person: the client half of src/careSpaces.ts's
// deleteCareSpace(). Storage cleanup cannot happen inside the database
// function (Postgres has no access to Storage), so this proves the
// client fetches every attachment path BEFORE calling the RPC, removes
// them from Storage afterward, and -- on a genuine Storage failure --
// queues them for retry rather than losing track of the cleanup, reusing
// the exact durable mechanism Phase 18 already built for individual
// document cleanup.

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockStorageRemove = jest.fn();

jest.mock('../src/auth/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: {
      from: () => ({
        remove: (...args: unknown[]) => mockStorageRemove(...args),
      }),
    },
  },
}));

const mockEnqueueCareSpaceStorageCleanup = jest.fn();
jest.mock('../src/documentCleanupQueue', () => ({
  enqueueCareSpaceStorageCleanup: (...args: unknown[]) => mockEnqueueCareSpaceStorageCleanup(...args),
}));

import { deleteCareSpace } from '../src/careSpaces';

function selectChain(rows: Array<{ storage_object_path: string }>) {
  return {
    select: () => ({
      eq: () => Promise.resolve({ data: rows, error: null }),
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('deleteCareSpace: storage cleanup ordering and durability', () => {
  it('fetches attachment paths, deletes the care space, then removes those paths from Storage', async () => {
    mockFrom.mockReturnValue(selectChain([{ storage_object_path: 'space-1/rec-1/a.pdf' }, { storage_object_path: 'space-1/rec-2/b.pdf' }]));
    mockRpc.mockResolvedValue({ error: null });
    mockStorageRemove.mockResolvedValue({ error: null });

    const result = await deleteCareSpace('owner-1', 'space-1');

    expect(result.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('delete_care_space', { target_care_space_id: 'space-1' });
    expect(mockStorageRemove).toHaveBeenCalledWith(['space-1/rec-1/a.pdf', 'space-1/rec-2/b.pdf']);
    expect(mockEnqueueCareSpaceStorageCleanup).not.toHaveBeenCalled();
  });

  it('never calls the RPC if there is nothing to attempt -- but does call it even with zero attachments', async () => {
    mockFrom.mockReturnValue(selectChain([]));
    mockRpc.mockResolvedValue({ error: null });

    const result = await deleteCareSpace('owner-1', 'space-1');

    expect(result.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('a real RPC failure (e.g. not an organiser) stops before touching Storage at all', async () => {
    mockFrom.mockReturnValue(selectChain([{ storage_object_path: 'space-1/rec-1/a.pdf' }]));
    mockRpc.mockResolvedValue({ error: { message: 'Only an active organiser of this care space can remove it', code: '42501' } });

    const result = await deleteCareSpace('owner-1', 'space-1');

    expect(result.ok).toBe(false);
    expect(mockStorageRemove).not.toHaveBeenCalled();
    expect(mockEnqueueCareSpaceStorageCleanup).not.toHaveBeenCalled();
  });

  it('a Storage removal failure AFTER a successful deletion queues the paths for retry, and still reports overall success', async () => {
    mockFrom.mockReturnValue(selectChain([{ storage_object_path: 'space-1/rec-1/a.pdf' }]));
    mockRpc.mockResolvedValue({ error: null });
    mockStorageRemove.mockResolvedValue({ error: { message: 'Network request failed' } });

    const result = await deleteCareSpace('owner-1', 'space-1');

    expect(result.ok).toBe(true);
    expect(mockEnqueueCareSpaceStorageCleanup).toHaveBeenCalledWith('owner-1', ['space-1/rec-1/a.pdf']);
  });
});
