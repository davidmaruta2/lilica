// Phase 18: "Device & local data" -- lets the app truthfully answer "what
// happens if I clear this phone?" before doing it, and actually clear
// only local state, never cloud data. Deliberately narrow: this module
// knows the mechanics of what's locally cached and how to remove it; the
// UI (src/screens/PrivacyDataScreen.tsx) owns deciding when to warn and
// asking for confirmation.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, Paths } from 'expo-file-system';

import { readRecordCache } from './recordSync';
import { hasPendingDocumentCleanup } from './documentCleanupQueue';
import { LilicaRecord } from './types';

export type PendingLocalWork = {
  hasPendingMutations: boolean;
  hasPendingUploads: boolean;
  hasPendingCleanup: boolean;
};

// Pure -- reused by both the app-wide upload-retry effect (App.tsx) and
// this "should I warn before clearing?" check, so the two definitions of
// "pending upload" never drift apart.
export function hasUnuploadedAttachment(records: LilicaRecord[]): boolean {
  return records.some((record) => record.type === 'document'
    && record.attachments?.some((attachment) => attachment.uri && attachment.uploadStatus !== 'uploaded'));
}

export async function pendingLocalWork(ownerId: string, currentRecords: LilicaRecord[]): Promise<PendingLocalWork> {
  const cache = await readRecordCache(ownerId);
  const hasPendingMutations = Object.values(cache.spaces).some((space) => space.outbox.length > 0);
  return {
    hasPendingMutations,
    hasPendingUploads: hasUnuploadedAttachment(currentRecords),
    hasPendingCleanup: await hasPendingDocumentCleanup(ownerId),
  };
}

// Removes ONLY this device's local copies -- the record cache/outbox
// cursor state, the downloaded-document preview cache, and this device's
// own captured/scanned attachment files. Never touches Supabase. Callers
// are expected to have already warned about (or the user to have
// accepted) any PendingLocalWork this would discard -- this function
// itself does not check, so it can also be reused for the unconditional
// "local cleanup after successful account deletion" case (Phase 18
// section 37), where warning no longer applies.
export async function clearLocalDataForOwner(ownerId: string): Promise<void> {
  await AsyncStorage.multiRemove([
    `lilica:onboarding:v1:${ownerId}`,
    `lilica:record-cache:v1:${ownerId}`,
    `lilica:document-cleanup-queue:v1:${ownerId}`,
  ]);
  try {
    new Directory(Paths.document, 'attachments').delete();
  } catch {
    // Nothing to delete, or already gone -- not an error.
  }
  try {
    new Directory(Paths.cache, 'attachment-previews').delete();
  } catch {
    // Nothing to delete, or already gone -- not an error.
  }
}
