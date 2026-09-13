// Phase 21B, brief section 28/19: a mutation rejected because commercial
// entitlement expired by the time it reached the server must never be
// silently discarded, and -- unlike a genuine permission denial -- must
// resume automatically once entitlement is restored, through the existing
// outbox/reconciliation model. This proves both halves of that behaviour
// using the exact same FakeTransport-style harness tests/record-sync.test.ts
// already establishes for this module, rather than a parallel mechanism.

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../src/auth/client', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

import {
  ApplyMutationResult,
  ENTITLEMENT_REQUIRED_MESSAGE,
  enqueueRecordUpsert,
  isEntitlementHeldMutation,
  prepareRecordCache,
  readRecordCache,
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
    id: 'task-1',
    type: 'task',
    title: 'Arrange transport',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
    ...patch,
  };
}

function space(records: LilicaRecord[]): LocalCareSpaceState {
  return {
    careSpaceId: spaceId,
    supportedPersonId: 'person-1',
    membershipId: 'membership-1',
    bootstrapId: 'bootstrap-1',
    relationshipType: 'Mum',
    displayName: 'Beauty',
    privacyDeclarationAccepted: true,
    interests: [],
    records,
    setupStatus: 'ready',
    allSetDismissed: true,
  };
}

// A transport that rejects every applyMutation call with the given error
// factory until `entitled` is flipped true, after which it succeeds --
// simulating "the user subscribed" happening between two sync passes.
// Throws RecordTransportError directly (category 'permission'),
// reproducing exactly the wrapping supabaseRecordTransport itself already
// performs on a real 42501 response before synchronizeRecords ever sees
// it -- not a raw Error, which would never realistically reach this code.
class GateableTransport implements RecordSyncTransport {
  entitled = false;
  makeError: () => Error = () => new RecordTransportError(ENTITLEMENT_REQUIRED_MESSAGE, 'permission');
  calls: RecordMutation[] = [];
  rows = new Map<string, ServerRecordRow>();
  sequence = 0;

  async applyMutation(mutation: RecordMutation, baseVersion: number): Promise<ApplyMutationResult> {
    this.calls.push({ ...mutation });
    if (!this.entitled) throw this.makeError();
    this.sequence += 1;
    this.rows.set(mutation.cloudRecordId, {
      id: mutation.cloudRecordId,
      care_space_id: mutation.careSpaceId,
      local_record_id: mutation.payload!.local_record_id,
      record_type: mutation.payload!.record_type,
      record_data: mutation.payload!.record_data,
      legacy_responsibility_text: mutation.payload!.legacy_responsibility_text ?? null,
      attachment_manifest: mutation.payload!.attachment_manifest,
      deleted_at: null,
      version: 1,
      change_sequence: this.sequence,
    });
    return { status: 'applied', version: 1, change_sequence: this.sequence };
  }

  async pullChanges() {
    return [];
  }
}

describe('Phase 21B: entitlement-held mutations survive rejection and resume on restoration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('marks a mutation rejected due to expired entitlement, but keeps retrying it on every subsequent sync -- and it succeeds once entitlement is restored', async () => {
    await prepareRecordCache(ownerId, [space([])]);
    await enqueueRecordUpsert(ownerId, spaceId, record());

    const transport = new GateableTransport();
    await synchronizeRecords(ownerId, [spaceId], transport, new Date('2026-09-13T10:00:00.000Z'));

    let cache = await readRecordCache(ownerId);
    expect(cache.spaces[spaceId].outbox).toHaveLength(1);
    expect(cache.spaces[spaceId].outbox[0].status).toBe('rejected');
    expect(cache.spaces[spaceId].outbox[0].lastError).toBe(ENTITLEMENT_REQUIRED_MESSAGE);
    expect(isEntitlementHeldMutation(cache.spaces[spaceId].outbox[0])).toBe(true);

    // A second sync pass WHILE STILL EXPIRED retries it again (never
    // permanently blocked, unlike a genuine permission rejection) --
    // still rejected, still held, no duplicate write.
    await synchronizeRecords(ownerId, [spaceId], transport, new Date('2026-09-13T11:00:00.000Z'));
    expect(transport.calls).toHaveLength(2);
    cache = await readRecordCache(ownerId);
    expect(cache.spaces[spaceId].outbox).toHaveLength(1);
    expect(cache.spaces[spaceId].outbox[0].status).toBe('rejected');

    // Entitlement is restored -- the very next sync pass resumes and
    // succeeds, using the SAME operation id (idempotency-safe), and the
    // mutation is cleared from the outbox exactly like any other
    // successfully-applied mutation.
    transport.entitled = true;
    await synchronizeRecords(ownerId, [spaceId], transport, new Date('2026-09-13T12:00:00.000Z'));
    expect(transport.calls).toHaveLength(3);
    expect(transport.calls[2].id).toBe(transport.calls[0].id);
    cache = await readRecordCache(ownerId);
    expect(cache.spaces[spaceId].outbox).toHaveLength(0);
    expect(Array.from(transport.rows.values())[0]?.record_data.title).toBe('Arrange transport');
  });

  it('a GENUINE (non-entitlement) permission rejection is never retried -- it stays permanently blocked, needing a new edit instead', async () => {
    await prepareRecordCache(ownerId, [space([])]);
    await enqueueRecordUpsert(ownerId, spaceId, record());

    const transport = new GateableTransport();
    transport.makeError = () => new RecordTransportError('Insufficient permission for this record domain', 'permission');
    await synchronizeRecords(ownerId, [spaceId], transport, new Date('2026-09-13T10:00:00.000Z'));

    let cache = await readRecordCache(ownerId);
    expect(cache.spaces[spaceId].outbox[0].status).toBe('rejected');
    expect(isEntitlementHeldMutation(cache.spaces[spaceId].outbox[0])).toBe(false);

    // Even once the transport WOULD succeed, a genuine (non-entitlement)
    // rejection is never retried automatically -- confirmed by no second
    // call ever reaching the transport.
    transport.entitled = true;
    await synchronizeRecords(ownerId, [spaceId], transport, new Date('2026-09-13T11:00:00.000Z'));
    expect(transport.calls).toHaveLength(1);
    cache = await readRecordCache(ownerId);
    expect(cache.spaces[spaceId].outbox).toHaveLength(1);
    expect(cache.spaces[spaceId].outbox[0].status).toBe('rejected');
  });
});
