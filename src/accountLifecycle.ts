// Phase 18: the client boundary for account-deletion eligibility and data
// export. Every authorisation/filtering invariant (domain grants, sole-
// organiser blocking, no-leak record links) is enforced server-side and
// covered by supabase/tests/database/phase18_privacy_export.test.sql --
// this file only wraps those calls, following the exact `{ok,
// data|message}` pattern src/careCircle.ts already established.
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

function fail(error: unknown): { ok: false; message: string } {
  return { ok: false, message: friendlyAuthError(error, 'profile') };
}

export type AccountDeletionBlocker = { careSpaceId: string; careSpaceName: string };

// Read-only. Returns the care spaces (if any) this account is the SOLE
// active organiser of -- account deletion must be refused client-side
// until every one of these is resolved (another organiser promoted, or
// the space's own lifecycle otherwise settled). Never deletes anything.
export async function checkAccountDeletionEligibility(): Promise<Result<AccountDeletionBlocker[]>> {
  const { data, error } = await supabase.rpc('account_deletion_precheck');
  if (error) return fail(error);
  const rows = (data ?? []) as Array<{ care_space_id: string; care_space_name: string; blocking: boolean }>;
  return {
    ok: true,
    data: rows.filter((row) => row.blocking).map((row) => ({ careSpaceId: row.care_space_id, careSpaceName: row.care_space_name })),
  };
}

// Fetches everything the signed-in user is currently authorised to read
// (src/../supabase/migrations/20260912150000_phase18_privacy_export.sql's
// export_my_data()), writes it to a local JSON file, then hands it to the
// native share/save sheet -- no export ever touches Supabase Storage or a
// signed URL; the file exists only on this device, generated fresh each
// time from the caller's own current permissions.
export async function exportMyData(): Promise<Result<void>> {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) return fail(error);
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = new FileSystem.File(FileSystem.Paths.cache, `lilica-export-${stamp}.json`);
    file.write(JSON.stringify(data, null, 2));
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, message: 'Saving files is not supported on this device.' };
    }
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, message: 'Your export could not be saved. Please try again.' };
  }
}
