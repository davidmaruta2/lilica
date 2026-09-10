import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './auth/client';
import { createUuid, isUuid, stableUuid } from './identifiers';
import { LilicaRecord, LocalCareSpaceState, RecordAttachment } from './types';

const RECORD_CACHE_VERSION = 1;
const RECORD_CACHE_KEY = 'lilica:record-cache:v1';

export type RecordMutationKind = 'create' | 'import' | 'update' | 'delete';
export type RecordMutationStatus = 'pending' | 'retryable' | 'conflict' | 'rejected';

export type RecordPayload = {
  local_record_id: string;
  record_type: LilicaRecord['type'];
  record_data: Record<string, unknown>;
  legacy_responsibility_text?: string;
  attachment_manifest: Array<Omit<RecordAttachment, 'uri'>>;
  base_record_data?: Record<string, unknown>;
  base_legacy_responsibility_text?: string | null;
  base_attachment_manifest?: Array<Omit<RecordAttachment, 'uri'>>;
};

export type RecordMutation = {
  id: string;
  careSpaceId: string;
  localRecordId: string;
  cloudRecordId: string;
  kind: RecordMutationKind;
  payload?: RecordPayload;
  status: RecordMutationStatus;
  attempts: number;
  createdAt: string;
  retryAt?: string;
  lastError?: string;
};

export type RecordIdentity = {
  cloudRecordId: string;
  serverVersion: number;
  serverPayload?: RecordPayload;
};

export type RecordMigrationState = {
  status: 'pending' | 'uploading' | 'complete' | 'attention_required';
  startedAt: string;
  completedAt?: string;
};

export type RecordSpaceCache = {
  records: LilicaRecord[];
  identities: Record<string, RecordIdentity>;
  outbox: RecordMutation[];
  conflicts: RecordMutation[];
  cursor: number;
  migration: RecordMigrationState;
};

export type RecordCacheStore = {
  version: 1;
  ownerId: string;
  spaces: Record<string, RecordSpaceCache>;
};

export type ServerRecordRow = {
  id: string;
  care_space_id: string;
  local_record_id: string;
  record_type: LilicaRecord['type'];
  record_data: Record<string, unknown>;
  legacy_responsibility_text: string | null;
  attachment_manifest: Array<Omit<RecordAttachment, 'uri'>>;
  deleted_at: string | null;
  version: number;
  change_sequence: number;
};

export type ApplyMutationResult = {
  status: 'applied' | 'duplicate' | 'conflict';
  version?: number;
  change_sequence?: number;
  reason?: string;
};

export interface RecordSyncTransport {
  applyMutation(mutation: RecordMutation, baseVersion: number): Promise<ApplyMutationResult>;
  pullChanges(careSpaceId: string, cursor: number): Promise<ServerRecordRow[]>;
}

class RecordTransportError extends Error {
  constructor(message: string, readonly category: 'retryable' | 'authentication' | 'permission' | 'validation') {
    super(message);
  }
}

function errorCategory(error: { code?: string; status?: number; message?: string }) {
  if (error.status === 401) return 'authentication' as const;
  if (error.status === 403 || error.code === '42501') return 'permission' as const;
  if (error.code?.startsWith('22') || error.status === 400) return 'validation' as const;
  return 'retryable' as const;
}

export const supabaseRecordTransport: RecordSyncTransport = {
  async applyMutation(mutation, baseVersion) {
    const { data, error } = await supabase.rpc('apply_record_mutation', {
      operation_id: mutation.id,
      target_record_id: mutation.cloudRecordId,
      target_care_space_id: mutation.careSpaceId,
      mutation_kind: mutation.kind,
      base_version: baseVersion,
      mutation_payload: mutation.payload ?? null,
    });
    if (error) throw new RecordTransportError(error.message, errorCategory(error));
    return data as ApplyMutationResult;
  },
  async pullChanges(careSpaceId, cursor) {
    const { data, error } = await supabase
      .from('records')
      .select('id, care_space_id, local_record_id, record_type, record_data, legacy_responsibility_text, attachment_manifest, deleted_at, version, change_sequence')
      .eq('care_space_id', careSpaceId)
      .gt('change_sequence', cursor)
      .order('change_sequence', { ascending: true });
    if (error) throw new RecordTransportError(error.message, errorCategory(error));
    return (data ?? []) as ServerRecordRow[];
  },
};

function storeKey(ownerId: string) {
  return `${RECORD_CACHE_KEY}:${ownerId}`;
}

function emptyStore(ownerId: string): RecordCacheStore {
  return { version: RECORD_CACHE_VERSION, ownerId, spaces: {} };
}

async function loadStore(ownerId: string): Promise<RecordCacheStore> {
  const raw = await AsyncStorage.getItem(storeKey(ownerId));
  if (!raw) return emptyStore(ownerId);
  const parsed = JSON.parse(raw) as Partial<RecordCacheStore>;
  if (parsed.version !== RECORD_CACHE_VERSION || parsed.ownerId !== ownerId || !parsed.spaces) {
    throw new Error('Unsupported record cache');
  }
  return parsed as RecordCacheStore;
}

async function saveStore(store: RecordCacheStore) {
  await AsyncStorage.setItem(storeKey(store.ownerId), JSON.stringify(store));
}

let storageQueue: Promise<unknown> = Promise.resolve();

function withStore<T>(ownerId: string, operation: (store: RecordCacheStore) => Promise<T> | T): Promise<T> {
  const run = storageQueue.then(async () => {
    const store = await loadStore(ownerId);
    const result = await operation(store);
    await saveStore(store);
    return result;
  });
  storageQueue = run.then(() => undefined, () => undefined);
  return run;
}

function cloudRecordId(ownerId: string, careSpaceId: string, localRecordId: string) {
  return isUuid(localRecordId)
    ? localRecordId
    : stableUuid(`phase7-record|${ownerId}|${careSpaceId}|${localRecordId}`);
}

export function recordPayload(record: LilicaRecord): RecordPayload {
  const { id, responsiblePerson, attachments, ...recordData } = record;
  return {
    local_record_id: id,
    record_type: record.type,
    record_data: recordData,
    legacy_responsibility_text: responsiblePerson,
    attachment_manifest: (attachments ?? []).map(({ uri: _uri, ...metadata }) => metadata),
  };
}

function importedMutation(ownerId: string, careSpaceId: string, record: LilicaRecord): RecordMutation {
  const cloudId = cloudRecordId(ownerId, careSpaceId, record.id);
  return {
    id: stableUuid(`phase7-import-operation|${ownerId}|${careSpaceId}|${cloudId}`),
    careSpaceId,
    localRecordId: record.id,
    cloudRecordId: cloudId,
    kind: 'import',
    payload: recordPayload(record),
    status: 'pending',
    attempts: 0,
    createdAt: record.createdAt,
  };
}

function createSpaceCache(ownerId: string, careSpaceId: string, records: LilicaRecord[], now: string): RecordSpaceCache {
  const identities = Object.fromEntries(records.map((record) => [
    record.id,
    { cloudRecordId: cloudRecordId(ownerId, careSpaceId, record.id), serverVersion: 0 },
  ]));
  return {
    records: [...records],
    identities,
    outbox: records.map((record) => importedMutation(ownerId, careSpaceId, record)),
    conflicts: [],
    cursor: 0,
    migration: { status: records.length ? 'pending' : 'complete', startedAt: now, completedAt: records.length ? undefined : now },
  };
}

function linkedSpace(space: Pick<LocalCareSpaceState, 'careSpaceId' | 'membershipId'>) {
  return Boolean(space.membershipId && isUuid(space.careSpaceId));
}

function snapshot(store: RecordCacheStore) {
  return Object.fromEntries(Object.entries(store.spaces).map(([id, space]) => [id, [...space.records]]));
}

export async function prepareRecordCache(
  ownerId: string,
  careSpaces: Array<Pick<LocalCareSpaceState, 'careSpaceId' | 'membershipId' | 'records'>>,
  now = new Date().toISOString(),
) {
  return withStore(ownerId, (store) => {
    for (const space of careSpaces) {
      if (!linkedSpace(space) || store.spaces[space.careSpaceId]) continue;
      store.spaces[space.careSpaceId] = createSpaceCache(ownerId, space.careSpaceId, space.records, now);
    }
    return snapshot(store);
  });
}

function ensureIdentity(ownerId: string, careSpaceId: string, space: RecordSpaceCache, localRecordId: string) {
  const existing = space.identities[localRecordId];
  if (existing) return existing;
  const identity = { cloudRecordId: cloudRecordId(ownerId, careSpaceId, localRecordId), serverVersion: 0 };
  space.identities[localRecordId] = identity;
  return identity;
}

function updatePayload(record: LilicaRecord, identity: RecordIdentity) {
  const payload = recordPayload(record);
  if (!identity.serverPayload) return payload;
  return {
    ...payload,
    base_record_data: identity.serverPayload.record_data,
    base_legacy_responsibility_text: identity.serverPayload.legacy_responsibility_text ?? null,
    base_attachment_manifest: identity.serverPayload.attachment_manifest,
  };
}

export async function enqueueRecordUpsert(
  ownerId: string,
  careSpaceId: string,
  record: LilicaRecord,
  now = new Date().toISOString(),
) {
  return withStore(ownerId, (store) => {
    const space = store.spaces[careSpaceId] ?? createSpaceCache(ownerId, careSpaceId, [], now);
    store.spaces[careSpaceId] = space;
    const identity = ensureIdentity(ownerId, careSpaceId, space, record.id);
    const existingIndex = space.records.findIndex((item) => item.id === record.id);
    space.records = existingIndex >= 0
      ? space.records.map((item) => item.id === record.id ? record : item)
      : [...space.records, record];

    const unsentCreate = space.outbox.find((item) => item.cloudRecordId === identity.cloudRecordId
      && (item.kind === 'create' || item.kind === 'import')
      && item.status !== 'rejected' && item.status !== 'conflict');
    if (identity.serverVersion === 0 && unsentCreate) {
      unsentCreate.payload = recordPayload(record);
      unsentCreate.status = 'pending';
      unsentCreate.retryAt = undefined;
      unsentCreate.lastError = undefined;
    } else {
      space.outbox.push({
        id: createUuid(),
        careSpaceId,
        localRecordId: record.id,
        cloudRecordId: identity.cloudRecordId,
        kind: identity.serverVersion === 0 ? 'create' : 'update',
        payload: identity.serverVersion === 0 ? recordPayload(record) : updatePayload(record, identity),
        status: 'pending',
        attempts: 0,
        createdAt: now,
      });
    }
    return [...space.records];
  });
}

export async function enqueueRecordDelete(
  ownerId: string,
  careSpaceId: string,
  localRecordId: string,
  now = new Date().toISOString(),
) {
  return withStore(ownerId, (store) => {
    const space = store.spaces[careSpaceId];
    if (!space) return [];
    const identity = ensureIdentity(ownerId, careSpaceId, space, localRecordId);
    space.records = space.records.filter((record) => record.id !== localRecordId);
    space.outbox.push({
      id: createUuid(),
      careSpaceId,
      localRecordId,
      cloudRecordId: identity.cloudRecordId,
      kind: 'delete',
      status: 'pending',
      attempts: 0,
      createdAt: now,
    });
    return [...space.records];
  });
}

function retryDelay(attempts: number, operationId: string) {
  const capped = Math.min(60_000, 1000 * (2 ** Math.min(attempts, 6)));
  const jitter = parseInt(operationId.slice(0, 2), 16) % 251;
  return capped + jitter;
}

function localRecordFromRow(row: ServerRecordRow, local?: LilicaRecord): LilicaRecord | undefined {
  if (row.deleted_at) return undefined;
  const data = row.record_data;
  if (!data || typeof data !== 'object' || typeof data.title !== 'string') return local;
  return {
    ...data,
    id: row.local_record_id,
    type: row.record_type,
    responsiblePerson: row.legacy_responsibility_text ?? undefined,
    attachments: local?.attachments,
  } as LilicaRecord;
}

function applyRemoteRows(space: RecordSpaceCache, rows: ServerRecordRow[]) {
  let cursorBlocked = false;
  for (const row of rows) {
    const localId = row.local_record_id;
    const blocked = space.outbox.some((operation) => operation.cloudRecordId === row.id);
    if (blocked) {
      cursorBlocked = true;
      continue;
    }
    space.identities[localId] = {
      cloudRecordId: row.id,
      serverVersion: row.version,
      serverPayload: {
        local_record_id: row.local_record_id,
        record_type: row.record_type,
        record_data: row.record_data,
        legacy_responsibility_text: row.legacy_responsibility_text ?? undefined,
        attachment_manifest: row.attachment_manifest,
      },
    };
    if (!cursorBlocked) space.cursor = Math.max(space.cursor, row.change_sequence);
    const local = space.records.find((record) => record.id === localId);
    const remote = localRecordFromRow(row, local);
    space.records = remote
      ? space.records.some((record) => record.id === localId)
        ? space.records.map((record) => record.id === localId ? remote : record)
        : [...space.records, remote]
      : space.records.filter((record) => record.id !== localId);
  }
}

function rejectedStatus(error: unknown): RecordMutationStatus {
  return error instanceof RecordTransportError && error.category !== 'retryable' ? 'rejected' : 'retryable';
}

export async function synchronizeRecords(
  ownerId: string,
  authorisedCareSpaceIds: string[],
  transport: RecordSyncTransport = supabaseRecordTransport,
  now = new Date(),
) {
  return withStore(ownerId, async (store) => {
    for (const careSpaceId of authorisedCareSpaceIds) {
      const space = store.spaces[careSpaceId];
      if (!space) continue;
      let pullVerified = false;
      if (space.migration.status === 'pending') space.migration.status = 'uploading';

      const blockedRecords = new Set<string>();
      for (const mutation of space.outbox) {
        if (blockedRecords.has(mutation.cloudRecordId)) continue;
        if (mutation.status === 'conflict' || mutation.status === 'rejected') {
          blockedRecords.add(mutation.cloudRecordId);
          continue;
        }
        if (mutation.retryAt && new Date(mutation.retryAt).getTime() > now.getTime()) {
          blockedRecords.add(mutation.cloudRecordId);
          continue;
        }
        const identity = space.identities[mutation.localRecordId];
        const baseVersion = mutation.kind === 'create' || mutation.kind === 'import'
          ? 0
          : identity?.serverVersion ?? 0;
        try {
          const result = await transport.applyMutation(mutation, baseVersion);
          mutation.attempts += 1;
          if (result.status === 'conflict') {
            mutation.status = 'conflict';
            mutation.lastError = result.reason ?? 'Record changed elsewhere';
            space.conflicts.push({ ...mutation });
            blockedRecords.add(mutation.cloudRecordId);
            continue;
          }
          if (identity && result.version !== undefined) identity.serverVersion = result.version;
          mutation.status = 'pending';
          mutation.lastError = undefined;
          mutation.retryAt = undefined;
          mutation.id = `acknowledged:${mutation.id}`;
        } catch (error) {
          mutation.attempts += 1;
          mutation.status = rejectedStatus(error);
          mutation.lastError = error instanceof Error ? error.message : 'Record sync failed';
          if (mutation.status === 'retryable') {
            mutation.retryAt = new Date(now.getTime() + retryDelay(mutation.attempts, mutation.id)).toISOString();
          }
          blockedRecords.add(mutation.cloudRecordId);
        }
      }
      space.outbox = space.outbox.filter((mutation) => !mutation.id.startsWith('acknowledged:'));

      try {
        const rows = await transport.pullChanges(careSpaceId, space.cursor);
        applyRemoteRows(space, rows);
        pullVerified = true;
      } catch {
        // The durable cache and outbox remain unchanged until a later pull succeeds.
      }

      const migrationBlocked = space.outbox.some((mutation) => mutation.kind === 'import');
      if (!migrationBlocked && pullVerified && space.migration.status !== 'complete') {
        space.migration = { ...space.migration, status: 'complete', completedAt: now.toISOString() };
      } else if (space.outbox.some((mutation) => mutation.kind === 'import' && (mutation.status === 'conflict' || mutation.status === 'rejected'))) {
        space.migration.status = 'attention_required';
      }
    }
    return snapshot(store);
  });
}

export function readRecordCache(ownerId: string) {
  return loadStore(ownerId);
}

export async function recordRetryDelay(
  ownerId: string,
  authorisedCareSpaceIds: string[],
  now = new Date(),
) {
  const store = await loadStore(ownerId);
  const retryTimes = authorisedCareSpaceIds.flatMap((careSpaceId) => (
    store.spaces[careSpaceId]?.outbox
      .filter((mutation) => mutation.status === 'pending' || mutation.status === 'retryable')
      .map((mutation) => mutation.retryAt ? new Date(mutation.retryAt).getTime() : now.getTime())
    ?? []
  ));
  return retryTimes.length ? Math.max(0, Math.min(...retryTimes) - now.getTime()) : undefined;
}
