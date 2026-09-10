import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../src/auth/client', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

import {
  ApplyMutationResult,
  enqueueRecordDelete,
  enqueueRecordUpsert,
  prepareRecordCache,
  readOccurrenceCache,
  readRecordCache,
  recordRetryDelay,
  RecordMutation,
  RecordSyncTransport,
  ServerRecordRow,
  ServerOccurrenceRow,
  synchronizeRecords,
} from '../src/recordSync';
import { LilicaRecord, LocalCareSpaceState } from '../src/types';

const ownerId = 'a0000000-0000-0000-0000-000000000001';
const jackieSpaceId = 'a1000000-0000-4000-a000-000000000001';
const beautySpaceId = 'a1000000-0000-4000-a000-000000000002';

function record(patch: Partial<LilicaRecord> = {}): LilicaRecord {
  return {
    id: 'task-legacy-1',
    type: 'task',
    title: 'Arrange transport',
    supportedPersonId: 'person-jackie',
    responsiblePerson: 'Sarah',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
    ...patch,
  };
}

function space(careSpaceId: string, records: LilicaRecord[]): LocalCareSpaceState {
  return {
    careSpaceId,
    supportedPersonId: `person-${careSpaceId}`,
    membershipId: `membership-${careSpaceId}`,
    bootstrapId: `bootstrap-${careSpaceId}`,
    relationshipType: 'Mum',
    displayName: careSpaceId === jackieSpaceId ? 'Jackie' : 'Beauty',
    privacyDeclarationAccepted: true,
    interests: [],
    records,
    setupStatus: 'ready',
    allSetDismissed: true,
  };
}

class FakeTransport implements RecordSyncTransport {
  rows = new Map<string, ServerRecordRow>();
  occurrenceRows = new Map<string, ServerOccurrenceRow>();
  receipts = new Map<string, ApplyMutationResult>();
  calls: RecordMutation[] = [];
  sequence = 0;
  failBeforeWrite = false;
  loseNextAcknowledgement = false;

  async applyMutation(mutation: RecordMutation, baseVersion: number): Promise<ApplyMutationResult> {
    this.calls.push({ ...mutation });
    if (this.failBeforeWrite) throw new Error('Network request failed');
    const receipt = this.receipts.get(mutation.id);
    if (receipt) return { ...receipt, status: 'duplicate' };
    const current = this.rows.get(mutation.cloudRecordId);
    let result: ApplyMutationResult;
    if (mutation.kind === 'create' || mutation.kind === 'import') {
      if (current || baseVersion !== 0) return { status: 'conflict', reason: 'record_already_exists' };
      const payload = mutation.payload!;
      this.sequence += 1;
      this.rows.set(mutation.cloudRecordId, {
        id: mutation.cloudRecordId,
        care_space_id: mutation.careSpaceId,
        local_record_id: payload.local_record_id,
        record_type: payload.record_type,
        record_data: payload.record_data,
        legacy_responsibility_text: payload.legacy_responsibility_text ?? null,
        attachment_manifest: payload.attachment_manifest,
        deleted_at: null,
        version: 1,
        change_sequence: this.sequence,
      });
      result = { status: 'applied', version: 1, change_sequence: this.sequence };
    } else {
      if (!current || current.version !== baseVersion || current.deleted_at) {
        return { status: 'conflict', reason: 'stale_version', version: current?.version };
      }
      this.sequence += 1;
      const next: ServerRecordRow = mutation.kind === 'delete'
        ? { ...current, deleted_at: '2026-09-10T12:00:00.000Z', version: current.version + 1, change_sequence: this.sequence }
        : {
            ...current,
            record_data: mutation.payload!.record_data,
            legacy_responsibility_text: mutation.payload!.legacy_responsibility_text ?? null,
            attachment_manifest: mutation.payload!.attachment_manifest,
            version: current.version + 1,
            change_sequence: this.sequence,
          };
      this.rows.set(mutation.cloudRecordId, next);
      result = { status: 'applied', version: next.version, change_sequence: this.sequence };
    }
    this.receipts.set(mutation.id, result);
    if (this.loseNextAcknowledgement) {
      this.loseNextAcknowledgement = false;
      throw new Error('Response lost');
    }
    return result;
  }

  async pullChanges(careSpaceId: string, cursor: number) {
    return [...this.rows.values()]
      .filter((row) => row.care_space_id === careSpaceId && row.change_sequence > cursor)
      .sort((left, right) => left.change_sequence - right.change_sequence);
  }

  async pullOccurrences(careSpaceId: string, cursor: number) {
    return [...this.occurrenceRows.values()]
      .filter((row) => row.care_space_id === careSpaceId && row.change_sequence > cursor)
      .sort((left, right) => left.change_sequence - right.change_sequence);
  }
}

describe('Phase 7 record cache, migration and sync', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('partitions legacy records by care space and creates deterministic migration identities once', async () => {
    const attachment = {
      id: 'attachment-1', kind: 'file' as const, uri: 'file://local/power.pdf', name: 'power.pdf', createdAt: '2026-09-01T09:00:00.000Z',
    };
    const jackie = record({ attachments: [attachment] });
    const beauty = record({ id: 'task-legacy-2', title: 'Book MOT', supportedPersonId: 'person-beauty' });
    const first = await prepareRecordCache(ownerId, [space(jackieSpaceId, [jackie]), space(beautySpaceId, [beauty])]);
    const firstStore = await readRecordCache(ownerId);
    const second = await prepareRecordCache(ownerId, [space(jackieSpaceId, [record({ title: 'Should not overwrite cache' })])]);
    const secondStore = await readRecordCache(ownerId);

    expect(first[jackieSpaceId]).toEqual([jackie]);
    expect(first[beautySpaceId]).toEqual([beauty]);
    expect(second[jackieSpaceId]).toEqual([jackie]);
    expect(secondStore.spaces[jackieSpaceId].outbox).toHaveLength(1);
    expect(secondStore.spaces[jackieSpaceId].outbox[0].id).toBe(firstStore.spaces[jackieSpaceId].outbox[0].id);
    expect(secondStore.spaces[jackieSpaceId].outbox[0].payload).toMatchObject({
      legacy_responsibility_text: 'Sarah',
      attachment_manifest: [{ id: 'attachment-1', kind: 'file', name: 'power.pdf' }],
    });
    expect(JSON.stringify(secondStore.spaces[jackieSpaceId].outbox[0].payload)).not.toContain('file://local');
    expect(secondStore.spaces[jackieSpaceId].outbox[0].payload).not.toHaveProperty('assignmentMembershipId');
  });

  it('keeps an offline create and outbox across restart, then uploads exactly once', async () => {
    await prepareRecordCache(ownerId, [space(jackieSpaceId, [])]);
    const created = record({ id: 'a7300000-0000-4000-a000-000000000001' });
    await enqueueRecordUpsert(ownerId, jackieSpaceId, created, '2026-09-10T10:00:00.000Z');
    const offline = new FakeTransport();
    offline.failBeforeWrite = true;
    await synchronizeRecords(ownerId, [jackieSpaceId], offline, new Date('2026-09-10T10:00:00.000Z'));

    const restarted = await readRecordCache(ownerId);
    expect(restarted.spaces[jackieSpaceId].records).toEqual([created]);
    expect(restarted.spaces[jackieSpaceId].outbox[0]).toMatchObject({ status: 'retryable', attempts: 1 });
    expect(await recordRetryDelay(ownerId, [jackieSpaceId], new Date('2026-09-10T10:00:00.000Z'))).toBeGreaterThanOrEqual(1000);

    const online = new FakeTransport();
    const synced = await synchronizeRecords(ownerId, [jackieSpaceId], online, new Date('2026-09-10T10:02:00.000Z'));
    expect(synced[jackieSpaceId]).toEqual([created]);
    expect(online.rows.size).toBe(1);
    expect((await readRecordCache(ownerId)).spaces[jackieSpaceId].outbox).toEqual([]);
  });

  it('keeps a deterministic dated occurrence in the account and care-space cache across restart', async () => {
    await prepareRecordCache(ownerId, [space(jackieSpaceId, [])]);
    const created = record({
      id: 'a7300000-0000-4000-a000-000000000011',
      dueDate: '2026-10-14',
    });
    await enqueueRecordUpsert(ownerId, jackieSpaceId, created);
    const beforeRestart = await readOccurrenceCache(ownerId, jackieSpaceId);
    const afterRestart = await readOccurrenceCache(ownerId, jackieSpaceId);
    expect(beforeRestart).toHaveLength(1);
    expect(afterRestart).toEqual(beforeRestart);
    expect(afterRestart[0]).toMatchObject({
      careSpaceId: jackieSpaceId,
      kind: 'action',
      dueOn: '2026-10-14',
      timing: { kind: 'date', date: '2026-10-14' },
    });
    expect(await readOccurrenceCache(ownerId, beautySpaceId)).toEqual([]);
  });

  it('does not let a later mutation overtake an earlier retry for the same record', async () => {
    const created = record({ id: 'a7300000-0000-4000-a000-000000000009' });
    await prepareRecordCache(ownerId, [space(jackieSpaceId, [created])]);
    const offline = new FakeTransport();
    await synchronizeRecords(ownerId, [jackieSpaceId], offline, new Date('2026-09-10T09:00:00.000Z'));
    offline.calls = [];

    await enqueueRecordUpsert(ownerId, jackieSpaceId, { ...created, title: 'First offline edit' }, '2026-09-10T10:00:00.000Z');
    offline.failBeforeWrite = true;
    await synchronizeRecords(ownerId, [jackieSpaceId], offline, new Date('2026-09-10T10:00:00.000Z'));
    await enqueueRecordUpsert(ownerId, jackieSpaceId, { ...created, title: 'Second offline edit' }, '2026-09-10T10:00:00.100Z');

    offline.failBeforeWrite = false;
    await synchronizeRecords(ownerId, [jackieSpaceId], offline, new Date('2026-09-10T10:00:00.200Z'));

    expect(offline.calls).toHaveLength(1);
    expect([...offline.rows.values()][0].record_data.title).toBe('Arrange transport');
    expect((await readRecordCache(ownerId)).spaces[jackieSpaceId].outbox).toHaveLength(2);
  });

  it('retries the same operation after a lost acknowledgement without duplicate creation', async () => {
    await prepareRecordCache(ownerId, [space(jackieSpaceId, [])]);
    await enqueueRecordUpsert(ownerId, jackieSpaceId, record({ id: 'a7300000-0000-4000-a000-000000000002' }));
    const server = new FakeTransport();
    server.loseNextAcknowledgement = true;
    await synchronizeRecords(ownerId, [jackieSpaceId], server, new Date('2026-09-10T10:00:00.000Z'));
    expect(server.rows.size).toBe(1);
    expect((await readRecordCache(ownerId)).spaces[jackieSpaceId].outbox).toHaveLength(1);

    await synchronizeRecords(ownerId, [jackieSpaceId], server, new Date('2026-09-10T10:02:00.000Z'));
    expect(server.rows.size).toBe(1);
    expect(server.calls).toHaveLength(2);
    expect(server.calls[0].id).toBe(server.calls[1].id);
    expect((await readRecordCache(ownerId)).spaces[jackieSpaceId].outbox).toEqual([]);
  });

  it('resumes a partially completed multi-record migration without replaying acknowledged records', async () => {
    const first = record({ id: 'legacy-first' });
    const second = record({ id: 'legacy-second', title: 'Second record' });
    await prepareRecordCache(ownerId, [space(jackieSpaceId, [first, second])]);
    const server = new FakeTransport();
    const apply = server.applyMutation.bind(server);
    let invocation = 0;
    server.applyMutation = async (mutation, baseVersion) => {
      invocation += 1;
      if (invocation === 2) throw new Error('Interrupted');
      return apply(mutation, baseVersion);
    };

    await synchronizeRecords(ownerId, [jackieSpaceId], server, new Date('2026-09-10T10:00:00.000Z'));
    let cache = await readRecordCache(ownerId);
    expect(server.rows.size).toBe(1);
    expect(cache.spaces[jackieSpaceId].outbox).toHaveLength(1);
    expect(cache.spaces[jackieSpaceId].migration.status).toBe('uploading');

    server.applyMutation = apply;
    await synchronizeRecords(ownerId, [jackieSpaceId], server, new Date('2026-09-10T10:02:00.000Z'));
    cache = await readRecordCache(ownerId);
    expect(server.rows.size).toBe(2);
    expect(cache.spaces[jackieSpaceId].outbox).toEqual([]);
    expect(cache.spaces[jackieSpaceId].migration.status).toBe('complete');
  });

  it('does not mark migration complete until an authorised pull verifies server state', async () => {
    await prepareRecordCache(ownerId, [space(jackieSpaceId, [record()])]);
    const server = new FakeTransport();
    const pull = server.pullChanges.bind(server);
    server.pullChanges = async () => { throw new Error('Pull unavailable'); };
    await synchronizeRecords(ownerId, [jackieSpaceId], server);
    expect((await readRecordCache(ownerId)).spaces[jackieSpaceId].migration.status).toBe('uploading');

    server.pullChanges = pull;
    await synchronizeRecords(ownerId, [jackieSpaceId], server);
    expect((await readRecordCache(ownerId)).spaces[jackieSpaceId].migration.status).toBe('complete');
    expect(server.rows.size).toBe(1);
  });

  it('syncs edits by server version and preserves incompatible stale edits as conflicts', async () => {
    const original = record({ id: 'a7300000-0000-4000-a000-000000000003' });
    await prepareRecordCache(ownerId, [space(jackieSpaceId, [original])]);
    const server = new FakeTransport();
    await synchronizeRecords(ownerId, [jackieSpaceId], server);

    await enqueueRecordUpsert(ownerId, jackieSpaceId, { ...original, title: 'Local edit' });
    expect((await readRecordCache(ownerId)).spaces[jackieSpaceId].outbox[0].payload).toMatchObject({
      base_record_data: expect.objectContaining({ title: 'Arrange transport' }),
      base_legacy_responsibility_text: 'Sarah',
      base_attachment_manifest: [],
    });
    const remote = server.rows.values().next().value as ServerRecordRow;
    server.rows.set(remote.id, { ...remote, record_data: { ...remote.record_data, title: 'Other device edit' }, version: 2, change_sequence: ++server.sequence });
    await synchronizeRecords(ownerId, [jackieSpaceId], server);

    const cache = await readRecordCache(ownerId);
    expect(cache.spaces[jackieSpaceId].records[0].title).toBe('Local edit');
    expect(cache.spaces[jackieSpaceId].outbox[0].status).toBe('conflict');
    expect(cache.spaces[jackieSpaceId].conflicts).toHaveLength(1);
    expect(server.rows.get(remote.id)?.record_data.title).toBe('Other device edit');
  });

  it('pulls unrelated remote records past a conflict without advancing beyond the blocked cursor', async () => {
    const original = record({ id: 'a7300000-0000-4000-a000-00000000000a' });
    await prepareRecordCache(ownerId, [space(jackieSpaceId, [original])]);
    const server = new FakeTransport();
    await synchronizeRecords(ownerId, [jackieSpaceId], server);
    await enqueueRecordUpsert(ownerId, jackieSpaceId, { ...original, title: 'Local edit' });

    const remote = server.rows.values().next().value as ServerRecordRow;
    server.rows.set(remote.id, { ...remote, record_data: { ...remote.record_data, title: 'Other device edit' }, version: 2, change_sequence: ++server.sequence });
    server.rows.set('a7300000-0000-4000-a000-00000000000b', {
      ...remote,
      id: 'a7300000-0000-4000-a000-00000000000b',
      local_record_id: 'a7300000-0000-4000-a000-00000000000b',
      record_data: { ...remote.record_data, title: 'Unrelated remote record' },
      version: 1,
      change_sequence: ++server.sequence,
    });

    await synchronizeRecords(ownerId, [jackieSpaceId], server);

    const cache = await readRecordCache(ownerId);
    expect(cache.spaces[jackieSpaceId].records.map((item) => item.title)).toContain('Unrelated remote record');
    expect(cache.spaces[jackieSpaceId].cursor).toBe(1);
  });

  it('keeps each queued mutation bound to its original care space when switching people', async () => {
    await prepareRecordCache(ownerId, [space(jackieSpaceId, []), space(beautySpaceId, [])]);
    await enqueueRecordUpsert(ownerId, jackieSpaceId, record({ id: 'a7300000-0000-4000-a000-000000000004' }));
    await enqueueRecordUpsert(ownerId, beautySpaceId, record({ id: 'a7300000-0000-4000-a000-000000000005', title: 'Beauty task' }));
    const server = new FakeTransport();
    await synchronizeRecords(ownerId, [beautySpaceId], server);
    expect([...server.rows.values()].map((row) => row.care_space_id)).toEqual([beautySpaceId]);
    expect((await readRecordCache(ownerId)).spaces[jackieSpaceId].outbox).toHaveLength(1);
  });

  it('does not sync queued work without an authorised signed-in care-space list', async () => {
    await prepareRecordCache(ownerId, [space(jackieSpaceId, [])]);
    await enqueueRecordUpsert(ownerId, jackieSpaceId, record({ id: 'a7300000-0000-4000-a000-000000000006' }));
    const server = new FakeTransport();
    await synchronizeRecords(ownerId, [], server);
    expect(server.calls).toEqual([]);
    expect((await readRecordCache(ownerId)).spaces[jackieSpaceId].outbox).toHaveLength(1);
  });

  it('represents remove as a durable delete operation and applies a remote tombstone', async () => {
    const existing = record({ id: 'a7300000-0000-4000-a000-000000000007' });
    await prepareRecordCache(ownerId, [space(jackieSpaceId, [existing])]);
    const server = new FakeTransport();
    await synchronizeRecords(ownerId, [jackieSpaceId], server);
    await enqueueRecordDelete(ownerId, jackieSpaceId, existing.id);
    expect((await readRecordCache(ownerId)).spaces[jackieSpaceId].records).toEqual([]);
    await synchronizeRecords(ownerId, [jackieSpaceId], server);
    expect([...server.rows.values()][0].deleted_at).not.toBeNull();
    expect((await readRecordCache(ownerId)).spaces[jackieSpaceId].records).toEqual([]);
  });

  it('pulls cloud records for a second device while keeping unavailable attachment bytes local', async () => {
    await prepareRecordCache(ownerId, [space(jackieSpaceId, [])]);
    const server = new FakeTransport();
    server.rows.set('a7300000-0000-4000-a000-000000000008', {
      id: 'a7300000-0000-4000-a000-000000000008',
      care_space_id: jackieSpaceId,
      local_record_id: 'a7300000-0000-4000-a000-000000000008',
      record_type: 'document',
      record_data: { title: 'Power of attorney', createdAt: '2026-09-01T09:00:00.000Z' },
      legacy_responsibility_text: null,
      attachment_manifest: [{ id: 'file-1', kind: 'file', name: 'poa.pdf', createdAt: '2026-09-01T09:00:00.000Z' }],
      deleted_at: null,
      version: 1,
      change_sequence: 1,
    });
    const pulled = await synchronizeRecords(ownerId, [jackieSpaceId], server);
    expect(pulled[jackieSpaceId][0]).toMatchObject({ id: 'a7300000-0000-4000-a000-000000000008', title: 'Power of attorney' });
    expect(pulled[jackieSpaceId][0].attachments).toBeUndefined();
  });

  it('reconciles the same canonical occurrence identity from a second device', async () => {
    await prepareRecordCache(ownerId, [space(jackieSpaceId, [])]);
    const server = new FakeTransport();
    const occurrenceId = 'a7400000-0000-4000-a000-000000000001';
    server.occurrenceRows.set(occurrenceId, {
      id: occurrenceId,
      care_space_id: jackieSpaceId,
      record_id: 'a7300000-0000-4000-a000-000000000008',
      occurrence_kind: 'event',
      status: 'scheduled',
      timing_kind: 'local_datetime',
      due_on: null,
      starts_on: '2026-10-25',
      starts_time: '01:30:00',
      timezone: 'Europe/London',
      instant_at: null,
      recurrence_series_id: null,
      sequence: 0,
      original_due_on: null,
      original_starts_on: '2026-10-25',
      completed_at: null,
      deleted_at: null,
      version: 1,
      change_sequence: 1,
    });
    await synchronizeRecords(ownerId, [jackieSpaceId], server);
    await synchronizeRecords(ownerId, [jackieSpaceId], server);
    expect(await readOccurrenceCache(ownerId, jackieSpaceId)).toEqual([
      expect.objectContaining({
        id: occurrenceId,
        recordId: 'a7300000-0000-4000-a000-000000000008',
        timing: { kind: 'local_datetime', date: '2026-10-25', time: '01:30', timezone: 'Europe/London' },
      }),
    ]);
  });
});
