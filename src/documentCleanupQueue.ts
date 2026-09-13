// Phase 18: closes the one durability gap Phase 17 explicitly named --
// deleting a document while offline (or when the fire-and-forget cleanup
// call simply failed) used to leave its cloud attachment bytes and
// record_links permanently stranded, since nothing remembered to retry.
//
// This is deliberately the smallest durable mechanism, not a generic job
// system: an AsyncStorage-backed queue, keyed by owner exactly like
// src/recordSync.ts's own cache, retried at the same lifecycle points
// (app startup, care-space records changing) via retryPendingDocumentCleanup().
// Every operation here is already idempotent server-side (remove_record_
// attachment/remove_record_link tombstone rather than hard-delete;
// Storage's own remove() is a no-op on an already-missing object) -- a
// repeated retry converges, never duplicates or corrupts state.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { removeAllLinksForRecord } from './recordLinks';
import { LilicaRecord } from './types';
import { supabase } from './auth/client';

const BUCKET = 'document-attachments';
const QUEUE_KEY = 'lilica:document-cleanup-queue:v1';

type PendingAttachment = { attachmentId: string; storageObjectPath?: string };
type PendingCleanup = { recordId: string; attachments: PendingAttachment[] };
type CleanupQueueStore = Record<string, PendingCleanup[]>; // keyed by ownerId

function storeKey(ownerId: string) {
  return `${QUEUE_KEY}:${ownerId}`;
}

async function readQueue(ownerId: string): Promise<PendingCleanup[]> {
  const raw = await AsyncStorage.getItem(storeKey(ownerId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(ownerId: string, queue: PendingCleanup[]): Promise<void> {
  await AsyncStorage.setItem(storeKey(ownerId), JSON.stringify(queue));
}

// Called synchronously (well, durably -- awaited) as the FIRST step of
// removing a document, before any network attempt -- so a restart or an
// offline delete can never forget this record still owes cloud cleanup.
export async function enqueueDocumentCleanup(ownerId: string, record: LilicaRecord): Promise<void> {
  if (record.type !== 'document') return;
  const attachments = (record.attachments ?? []).map((attachment) => ({
    attachmentId: attachment.id,
    storageObjectPath: attachment.storageObjectPath,
  }));
  const queue = await readQueue(ownerId);
  if (queue.some((entry) => entry.recordId === record.id)) return; // already queued, idempotent
  queue.push({ recordId: record.id, attachments });
  await writeQueue(ownerId, queue);
}

async function attemptOne(entry: PendingCleanup): Promise<boolean> {
  try {
    await Promise.all(entry.attachments.map(async (attachment) => {
      if (attachment.storageObjectPath) {
        await supabase.storage.from(BUCKET).remove([attachment.storageObjectPath]);
      }
      await supabase.rpc('remove_record_attachment', { target_attachment_id: attachment.attachmentId });
    }));
    await removeAllLinksForRecord(entry.recordId);
    return true;
  } catch {
    return false;
  }
}

// Retried at existing lifecycle points (app startup once authenticated,
// and whenever the active care space's records change/reconcile -- see
// App.tsx) rather than a dedicated background daemon. A queue entry is
// removed only once its cleanup has genuinely succeeded; a failure (still
// offline, a transient error) leaves it for the next retry, forever
// idempotent since every underlying operation already is.
export async function retryPendingDocumentCleanup(ownerId: string): Promise<void> {
  const queue = await readQueue(ownerId);
  if (queue.length === 0) return;
  const remaining: PendingCleanup[] = [];
  for (const entry of queue) {
    const done = await attemptOne(entry);
    if (!done) remaining.push(entry);
  }
  if (remaining.length !== queue.length) await writeQueue(ownerId, remaining);
}

// Used by "Clear data from this device" (Phase 18) to warn before
// discarding local state that would strand this cleanup forever.
export async function hasPendingDocumentCleanup(ownerId: string): Promise<boolean> {
  const queue = await readQueue(ownerId);
  return queue.length > 0;
}

// Remove-supported-person (src/careSpaces.ts's deleteCareSpace()): a
// smaller sibling queue for the specific case where the DB rows are
// already gone (the whole care space was just deleted) so there is no
// longer any record/attachment id to call remove_record_attachment()
// against -- only a raw Storage object path to remove directly. Kept as
// its own tiny queue rather than folded into PendingCleanup above, since
// its retry step is genuinely simpler (no RPC call, no record_links) and
// conflating the two shapes would make both harder to read.
const STORAGE_QUEUE_KEY = 'lilica:care-space-storage-cleanup-queue:v1';

function storageQueueKey(ownerId: string): string {
  return `${STORAGE_QUEUE_KEY}:${ownerId}`;
}

async function readStorageQueue(ownerId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(storageQueueKey(ownerId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeStorageQueue(ownerId: string, paths: string[]): Promise<void> {
  await AsyncStorage.setItem(storageQueueKey(ownerId), JSON.stringify(paths));
}

export async function enqueueCareSpaceStorageCleanup(ownerId: string, storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) return;
  const existing = await readStorageQueue(ownerId);
  await writeStorageQueue(ownerId, [...new Set([...existing, ...storagePaths])]);
}

export async function retryPendingCareSpaceStorageCleanup(ownerId: string): Promise<void> {
  const queue = await readStorageQueue(ownerId);
  if (queue.length === 0) return;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove(queue);
    if (error) throw error;
    await writeStorageQueue(ownerId, []);
  } catch {
    // Still offline, or a transient error -- left in the queue for the
    // next retry. Storage's own remove() is a no-op on an already-missing
    // object, so a partial prior success is never re-attempted unsafely.
  }
}

export async function hasPendingCareSpaceStorageCleanup(ownerId: string): Promise<boolean> {
  const queue = await readStorageQueue(ownerId);
  return queue.length > 0;
}
