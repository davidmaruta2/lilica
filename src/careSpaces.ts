import { friendlyAuthError } from './auth/errors';
import { supabase } from './auth/client';
import { ProvisionedPerson } from './careSpaceState';
import { SupportedPersonDraft } from './types';

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
