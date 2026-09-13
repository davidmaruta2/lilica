import { friendlyAuthError } from './auth/errors';
import { supabase } from './auth/client';
import { ProvisionedPerson } from './careSpaceState';
import { enqueueCareSpaceStorageCleanup } from './documentCleanupQueue';
import { SupportedPersonDraft } from './types';

const ATTACHMENT_BUCKET = 'document-attachments';

type Result =
  | { ok: true; people: ProvisionedPerson[] }
  | { ok: false; message: string };

type BootstrapRow = {
  draft_id: string;
  care_space_id: string;
  supported_person_id: string;
  membership_id: string;
  display_name?: string;
  relationship_type?: SupportedPersonDraft['relationshipType'];
  relationship_label?: string | null;
  // Only present on list_my_supported_people()'s own response
  // (bootstrap_supported_people's return shape is unchanged) -- see
  // provisionedPerson() below.
  role?: 'organiser' | 'contributor' | 'viewer';
};

function provisionedPerson(row: BootstrapRow): ProvisionedPerson {
  return {
    draftId: row.draft_id,
    careSpaceId: row.care_space_id,
    supportedPersonId: row.supported_person_id,
    membershipId: row.membership_id,
    displayName: row.display_name,
    relationshipType: row.relationship_type,
    relationshipLabel: row.relationship_label ?? undefined,
    role: row.role,
  };
}

export async function provisionSupportedPeople(people: SupportedPersonDraft[]): Promise<Result> {
  const payload = people.map((person) => ({
    draft_id: person.draftId,
    display_name: person.displayName?.trim(),
    relationship_type: person.relationshipType,
    relationship_label: person.relationshipLabel?.trim() || null,
  }));
  const { data, error } = await supabase.rpc('bootstrap_supported_people', { people_payload: payload });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };

  return {
    ok: true,
    people: ((data ?? []) as BootstrapRow[]).map(provisionedPerson),
  };
}
export async function reconnectCareSpaces(): Promise<Result> {
  const { data, error } = await supabase.rpc('list_my_supported_people');
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  return {
    ok: true,
    people: ((data ?? []) as BootstrapRow[]).map(provisionedPerson),
  };
}

// The organiser-initiated "remove a supported person" capability -- a real
// gap until this was added: delete_my_account() only ever DETACHES
// memberships (Phase 18B), it never deletes a care space or its records;
// leave_care_space()/remove_member() only ever end one membership. This is
// the first thing in the schema that genuinely, irreversibly deletes a
// whole care space and everything under it. Any active organiser of the
// target care space may call it -- not only a sole organiser, the same
// authority level remove_member()/change_member_role() already grant.
//
// Storage cleanup (the private document-attachments bucket) cannot happen
// inside the database function -- Postgres has no access to Storage
// objects -- so every attachment's storage_object_path for this care space
// is fetched here FIRST (a plain authenticated read, already permitted to
// an organiser under existing RLS), the DB deletion runs, and only THEN are
// those objects best-effort removed from Storage; a failure (offline, a
// transient error) is queued for retry via the same durable mechanism
// Phase 18 already built for individual document cleanup
// (src/documentCleanupQueue.ts), reused rather than duplicated.
export async function deleteCareSpace(ownerId: string, careSpaceId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: attachments } = await supabase
    .from('record_attachments')
    .select('storage_object_path')
    .eq('care_space_id', careSpaceId);
  const storagePaths = ((attachments ?? []) as Array<{ storage_object_path: string }>)
    .map((row) => row.storage_object_path)
    .filter(Boolean);

  const { error } = await supabase.rpc('delete_care_space', { target_care_space_id: careSpaceId });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };

  if (storagePaths.length > 0) {
    try {
      const { error: storageError } = await supabase.storage.from(ATTACHMENT_BUCKET).remove(storagePaths);
      if (storageError) throw storageError;
    } catch {
      await enqueueCareSpaceStorageCleanup(ownerId, storagePaths);
    }
  }

  return { ok: true };
}
