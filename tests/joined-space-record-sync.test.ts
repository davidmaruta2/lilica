// 4 November 2026 two-device test, finding F7: after accepting an invitation
// the joiner's Home stayed empty ("still needs setting up", blank tabs) until
// the app was killed and reopened. Acceptance now loads the joined space's
// records explicitly through syncJoinedCareSpaces().

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../src/auth/client', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

import {
  ApplyMutationResult,
  readRecordCache,
  RecordMutation,
  RecordSyncTransport,
  ServerRecordRow,
  syncJoinedCareSpaces,
} from '../src/recordSync';

const joinerId = 'b0000000-0000-0000-0000-000000000002';
const robinSpaceId = 'c1000000-0000-4000-a000-000000000001';

function serverRow(id: string, title: string, sequence: number): ServerRecordRow {
  return {
    id,
    care_space_id: robinSpaceId,
    local_record_id: `local-${id}`,
    record_type: 'appointment',
    record_data: { title },
    legacy_responsibility_text: null,
    attachment_manifest: [],
    deleted_at: null,
    version: 1,
    change_sequence: sequence,
  };
}

class FakeTransport implements RecordSyncTransport {
  pulls: string[] = [];
  constructor(private readonly rows: ServerRecordRow[]) {}
  async applyMutation(_mutation: RecordMutation): Promise<ApplyMutationResult> {
    return { status: 'applied', version: 1, change_sequence: 1 };
  }
  async pullChanges(careSpaceId: string) {
    this.pulls.push(careSpaceId);
    return this.rows;
  }
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('syncJoinedCareSpaces (F7)', () => {
  it('returns the joined space\'s records straight away, with no prior cache for it', async () => {
    const transport = new FakeTransport([
      serverRow('d1000000-0000-4000-a000-000000000001', 'Orthopaedic', 1),
      serverRow('d1000000-0000-4000-a000-000000000002', 'Insurance bill', 2),
    ]);
    const cached = await syncJoinedCareSpaces(joinerId, [{ careSpaceId: robinSpaceId, membershipId: 'm-1' }], transport);
    expect(transport.pulls).toEqual([robinSpaceId]);
    expect(cached[robinSpaceId]).toHaveLength(2);
    expect(cached[robinSpaceId].map((record) => record.title).sort()).toEqual(['Insurance bill', 'Orthopaedic']);
  });

  it('persists them, so a later normal sync starts from the same cache', async () => {
    const transport = new FakeTransport([serverRow('d1000000-0000-4000-a000-000000000003', 'Dentist', 1)]);
    await syncJoinedCareSpaces(joinerId, [{ careSpaceId: robinSpaceId, membershipId: 'm-1' }], transport);
    const store = await readRecordCache(joinerId);
    expect(store.spaces[robinSpaceId].records).toHaveLength(1);
  });

  it('is safe to call twice and does not duplicate records', async () => {
    const transport = new FakeTransport([serverRow('d1000000-0000-4000-a000-000000000004', 'Dentist', 1)]);
    const spaces = [{ careSpaceId: robinSpaceId, membershipId: 'm-1' }];
    await syncJoinedCareSpaces(joinerId, spaces, transport);
    const second = await syncJoinedCareSpaces(joinerId, spaces, transport);
    expect(second[robinSpaceId]).toHaveLength(1);
  });

  it('ignores spaces without a membership or a real id, and does nothing when none are left', async () => {
    const transport = new FakeTransport([]);
    const cached = await syncJoinedCareSpaces(
      joinerId,
      [{ careSpaceId: 'local-abc' }, { careSpaceId: robinSpaceId }],
      transport,
    );
    expect(cached).toEqual({});
    expect(transport.pulls).toEqual([]);
  });
});
