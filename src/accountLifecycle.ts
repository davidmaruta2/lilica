// Phase 18/18B: the client boundary for account-deletion eligibility, real
// account deletion, and data export (including actual document files).
// Every authorisation/filtering invariant (domain grants, sole-organiser
// blocking, no-leak record links, former-membership access denial) is
// enforced server-side and covered by
// supabase/tests/database/phase18_privacy_export.test.sql and
// supabase/tests/database/phase18b_account_deletion.test.sql -- this file
// only wraps those calls, following the exact `{ok, data|message}` pattern
// src/careCircle.ts already established.
//
// Profile display-name editing deliberately does NOT live here -- it
// reuses src/auth/AuthProvider.tsx's existing `saveProfile()` (the exact
// same function onboarding's "About you" step already calls), so there
// is only ever one place that writes `profiles.display_name` and keeps
// the in-memory profile state in sync with it.

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { friendlyAuthError } from './auth/errors';
import { supabase } from './auth/client';

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const BUCKET = 'document-attachments';
const SIGNED_URL_TTL_SECONDS = 60 * 5;

function fail(error: unknown): { ok: false; message: string } {
  return { ok: false, message: friendlyAuthError(error, 'profile') };
}

export type AccountDeletionBlocker = { careSpaceId: string; careSpaceName: string };

// Read-only. Returns the care spaces (if any) this account is the SOLE
// active organiser of -- account deletion must be refused client-side
// until every one of these is resolved (another organiser promoted, or
// the space's own lifecycle otherwise settled). Never deletes anything.
// delete_my_account() itself re-runs this exact same check server-side
// before ever touching anything -- this is only what lets the UI explain
// a blocker BEFORE the user attempts the destructive action.
export async function checkAccountDeletionEligibility(): Promise<Result<AccountDeletionBlocker[]>> {
  const { data, error } = await supabase.rpc('account_deletion_precheck');
  if (error) return fail(error);
  const rows = (data ?? []) as Array<{ care_space_id: string; care_space_name: string; blocking: boolean }>;
  return {
    ok: true,
    data: rows.filter((row) => row.blocking).map((row) => ({ careSpaceId: row.care_space_id, careSpaceName: row.care_space_name })),
  };
}

// Phase 18B: the real, destructive account-deletion operation. Requires
// network access (never queued for later -- section 27 of the brief:
// this is too destructive for deferred/offline execution). Server
// deletion happens FIRST; only once it genuinely succeeds does this
// clear the device's own local protected data for this account (section
// 24 -- if the server call fails, local recoverability is never
// destroyed). Mirrors src/localData.ts's clearLocalDataForOwner()
// exactly, reused rather than duplicated -- see PrivacyDataScreen.tsx/
// App.tsx for the sign-out that follows a successful call.
export async function deleteMyAccount(): Promise<Result<void>> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    // delete_my_account() raises a plain-language message naming the
    // blocking care space directly (e.g. "Cannot delete account: Beauty
    // still depends on you...") -- surfaced verbatim rather than passed
    // through friendlyAuthError, which would otherwise genericise it.
    const message = typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message.replace(/^.*?Cannot delete account:/, 'Cannot delete account:')
      : undefined;
    return { ok: false, message: message || friendlyAuthError(error, 'profile') };
  }
  return { ok: true, data: undefined };
}

function safeSegment(name: string, fallback: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._ -]/g, '_').trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

// A file/care-space name a viewer would recognise, never an internal
// UUID, with deterministic de-duplication so two documents that would
// otherwise collide ("letter.pdf" twice in the same care space) both
// survive as distinct, safely-named files (section 32).
function dedupeName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  let n = 2;
  let candidate = `${stem} (${n})${ext}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${stem} (${n})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

export type ExportFile = { label: string; uri: string; mimeType?: string };
export type ExportResult = { files: ExportFile[]; skippedDocuments: number };

type ExportAttachment = {
  id: string;
  recordId: string;
  displayName: string;
  mimeType?: string;
  uploadStatus?: string;
  fileAvailable?: boolean;
  exportPath?: string;
};
type ExportSpace = { careSpaceName: string; attachments?: ExportAttachment[] };
type ExportData = { careSpaces?: ExportSpace[] };

// Phase 18B section 30/31: the export must include actual authorised
// document files, not metadata alone -- but per direct product-owner
// decision, NOT as a single .zip (no zip dependency was approved for this
// pass -- see docs/PHASE_18_ARCHITECTURE.md's Phase 18B addendum). Every
// file this produces (data.json, plus one per authorised, available
// document) is offered individually through the native share sheet, one
// at a time -- PrivacyDataScreen renders the returned list with its own
// Share action per row.
//
// The authoritative file source is always the current cloud copy
// (server storage_object_path, downloaded fresh via a short-lived signed
// URL) -- never a possibly-stale local device copy (section 30's own
// instruction). A legacy/never-uploaded attachment is skipped, not
// fabricated, and counted in `skippedDocuments` so the UI can say so
// honestly; the corresponding data.json entry still carries
// `fileAvailable: false` rather than silently disappearing.
//
// Every attachment id in the export JSON was already filtered server-side
// by export_my_data() through the exact same domain-grant check every
// other read uses -- this function never fetches anything export_my_data
// didn't already decide the caller may see, and the storage download
// itself is independently re-checked by the bucket's own RLS policy.
export async function exportMyData(): Promise<Result<ExportResult>> {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) return fail(error);

  const exportData = data as ExportData;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const root = new FileSystem.Directory(FileSystem.Paths.cache, `lilica-export-${stamp}`);

  try {
    root.create({ idempotent: true, intermediates: true });
    const files: ExportFile[] = [];
    let skippedDocuments = 0;
    const usedSpaceNames = new Set<string>();

    for (const space of exportData.careSpaces ?? []) {
      const attachments = space.attachments ?? [];
      if (attachments.length === 0) continue;

      const spaceFolderName = dedupeName(safeSegment(space.careSpaceName, 'Care space'), usedSpaceNames);
      const spaceDirectory = new FileSystem.Directory(root, 'documents', spaceFolderName);
      spaceDirectory.create({ idempotent: true, intermediates: true });
      const usedFileNames = new Set<string>();

      for (const attachment of attachments) {
        // Look up the storage path directly -- record_attachments' own
        // SELECT RLS already scopes this to exactly what export_my_data()
        // itself just authorised (same domain-grant decision); never put
        // this path in data.json itself (section 33/34).
        const { data: row } = await supabase
          .from('record_attachments')
          .select('storage_object_path')
          .eq('id', attachment.id)
          .maybeSingle();
        const storageObjectPath = (row as { storage_object_path?: string } | null)?.storage_object_path;

        if (!storageObjectPath || attachment.uploadStatus !== 'uploaded') {
          attachment.fileAvailable = false;
          skippedDocuments += 1;
          continue;
        }

        try {
          const { data: signed, error: signError } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(storageObjectPath, SIGNED_URL_TTL_SECONDS);
          if (signError || !signed?.signedUrl) throw signError ?? new Error('no signed url');

          const fileName = dedupeName(safeSegment(attachment.displayName, 'Document'), usedFileNames);
          const destination = new FileSystem.File(spaceDirectory, fileName);
          await FileSystem.File.downloadFileAsync(signed.signedUrl, destination, { idempotent: true });

          attachment.fileAvailable = true;
          attachment.exportPath = `documents/${spaceFolderName}/${fileName}`;
          files.push({ label: `${spaceFolderName} / ${fileName}`, uri: destination.uri, mimeType: attachment.mimeType });
        } catch {
          // Never abort the whole export for one unreachable file --
          // truthfully mark it unavailable and continue (section 37).
          attachment.fileAvailable = false;
          skippedDocuments += 1;
        }
      }
    }

    const dataFile = new FileSystem.File(root, 'data.json');
    dataFile.write(JSON.stringify(exportData, null, 2));
    files.unshift({ label: 'data.json', uri: dataFile.uri, mimeType: 'application/json' });

    return { ok: true, data: { files, skippedDocuments } };
  } catch {
    return { ok: false, message: 'Your export could not be prepared. Please try again.' };
  }
}

// Shares one previously-generated export file (see exportMyData()) via
// the native share/save sheet. Kept separate from generation so
// PrivacyDataScreen can offer each file its own Share action without
// re-running the whole export.
export async function shareExportFile(file: ExportFile): Promise<Result<void>> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, message: 'Saving files is not supported on this device.' };
    }
    await Sharing.shareAsync(file.uri, file.mimeType ? { mimeType: file.mimeType } : undefined);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, message: 'This file could not be shared. Please try again.' };
  }
}
