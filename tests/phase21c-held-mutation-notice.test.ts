// Phase 21C: hasEntitlementHeldMutations() is the one read the app-level
// friendly-notice surface (App.tsx) needs to detect the rare race where a
// mutation was rejected because entitlement expired between the form
// being opened and the sync actually reaching the server -- the proactive
// gate already stops the common case; this only covers what recordSync's
// own existing held-mutation mechanism (Phase 21B) already tracks. No new
// state, just a narrow read reusing isEntitlementHeldMutation().

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../src/auth/client', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

import {
  ApplyMutationResult,
  ENTITLEMENT_REQUIRED_MESSAGE,
  enqueueRecordUpsert,
  hasEntitlementHeldMutations,
  prepareRecordCache,
  RecordMutation,
  RecordSyncTransport,
  RecordTransportError,
  ServerRecordRow,
  synchronizeRecords,
} from '../src/recordSync';
import { LilicaRecord, LocalCareSpaceState } from '../src/types';

const ownerId = 'a0000000-0000-0000-0000-000000000001';
const spaceId = 'a1000000-0000-4000-a000-000000000001';

function record(patch: Partial<LilicaRecord> = {}): LilicaRecord {
  return {
    id: 'task-1', type: 'task', title: 'Arrange transport',
    createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z',
    ...patch,
  };
}

function space(records: LilicaRecord[]): LocalCareSpaceState {
  return {
    careSpaceId: spaceId, supportedPersonId: 'person-1', membershipId: 'membership-1',
    bootstrapId: 'bootstrap-1', relationshipType: 'Mum', displayName: 'Beauty',
    privacyDeclarationAccepted: true, interests: [], records, setupStatus: 'ready', allSetDismissed: true,
  };
}

class GateableTransport implements RecordSyncTransport {
  entitled = false;
  rows = new Map<string, ServerRecordRow>();
  sequence = 0;
  async applyMutation(mutation: RecordMutation): Promise<ApplyMutationResult> {
    if (!this.entitled) throw new RecordTransportError(ENTITLEMENT_REQUIRED_MESSAGE, 'permission');
    this.sequence += 1;
    this.rows.set(mutation.cloudRecordId, {
      id: mutation.cloudRecordId, care_space_id: mutation.careSpaceId,
      local_record_id: mutation.payload!.local_record_id, record_type: mutation.payload!.record_type,
      record_data: mutation.payload!.record_data, legacy_responsibility_text: mutation.payload!.legacy_responsibility_text ?? null,
      attachment_manifest: mutation.payload!.attachment_manifest, deleted_at: null, version: 1, change_sequence: this.sequence,
    });
    return { status: 'applied', version: 1, change_sequence: this.sequence };
  }
  async pullChanges() { return []; }
}

describe('hasEntitlementHeldMutations: the friendly-notice detection read', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('is false for a care space with no cache at all', async () => {
    expect(await hasEntitlementHeldMutations(ownerId, spaceId)).toBe(false);
  });

  it('is false while everything syncs normally', async () => {
    await prepareRecordCache(ownerId, [space([])]);
    await enqueueRecordUpsert(ownerId, spaceId, record());
    const transport = new GateableTransport();
    transport.entitled = true;
    await synchronizeRecords(ownerId, [spaceId], transport);
    expect(await hasEntitlementHeldMutations(ownerId, spaceId)).toBe(false);
  });

  it('becomes true once a mutation is held for exceeding entitlement, and false again once it resolves', async () => {
    await prepareRecordCache(ownerId, [space([])]);
    await enqueueRecordUpsert(ownerId, spaceId, record());
    const transport = new GateableTransport();
    await synchronizeRecords(ownerId, [spaceId], transport);
    expect(await hasEntitlementHeldMutations(ownerId, spaceId)).toBe(true);

    transport.entitled = true;
    await synchronizeRecords(ownerId, [spaceId], transport);
    expect(await hasEntitlementHeldMutations(ownerId, spaceId)).toBe(false);
  });
});
