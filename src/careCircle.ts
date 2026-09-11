// Phase 15: the client boundary for the care-circle invitation/membership
// RPCs added in supabase/migrations/20260911120000_phase15_care_circle.sql.
// Every function here is a thin, typed wrapper -- all authorisation,
// idempotency and the assignment-visibility invariant live server-side.
// See docs/PHASE_15_ARCHITECTURE.md.

import { createUuid } from './identifiers';
import { friendlyAuthError } from './auth/errors';
import { supabase } from './auth/client';
import { Relationship } from './types';

export type CareCircleRole = 'organiser' | 'contributor' | 'viewer';
export type CareCircleDomain = 'general' | 'health' | 'financial' | 'home' | 'documents';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';

export type CareCircleMember = {
  membershipId: string;
  displayName: string;
  role: CareCircleRole;
  relationshipType: Relationship;
  relationshipLabel?: string;
  isSelf: boolean;
  grantedDomains: CareCircleDomain[];
};

export type CareCircleInvitation = {
  id: string;
  inviteeEmail: string;
  role: CareCircleRole;
  relationshipType: Relationship;
  relationshipLabel?: string;
  grantedDomains: CareCircleDomain[];
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
};

export type MyInvitation = {
  id: string;
  careSpaceId: string;
  careSpaceName: string;
  invitedByDisplayName: string;
  role: CareCircleRole;
  relationshipType: Relationship;
  relationshipLabel?: string;
  grantedDomains: CareCircleDomain[];
  createdAt: string;
  expiresAt: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function fail(error: unknown): { ok: false; message: string } {
  return { ok: false, message: friendlyAuthError(error, 'profile') };
}

export async function listCareSpaceMembers(careSpaceId: string): Promise<Result<CareCircleMember[]>> {
  const { data, error } = await supabase.rpc('list_care_space_members', { target_care_space_id: careSpaceId });
  if (error) return fail(error);
  const rows = (data ?? []) as Array<{
    membership_id: string;
    display_name: string;
    role: CareCircleRole;
    relationship_type: Relationship;
    relationship_label: string | null;
    is_self: boolean;
    granted_domains: CareCircleDomain[];
  }>;
  return {
    ok: true,
    data: rows.map((row) => ({
      membershipId: row.membership_id,
      displayName: row.display_name,
      role: row.role,
      relationshipType: row.relationship_type,
      relationshipLabel: row.relationship_label ?? undefined,
      isSelf: row.is_self,
      grantedDomains: row.granted_domains,
    })),
  };
}

export async function listCareSpaceInvitations(careSpaceId: string): Promise<Result<CareCircleInvitation[]>> {
  const { data, error } = await supabase.rpc('list_care_space_invitations', { target_care_space_id: careSpaceId });
  if (error) return fail(error);
  const rows = (data ?? []) as Array<{
    id: string;
    invitee_email: string;
    role: CareCircleRole;
    relationship_type: Relationship;
    relationship_label: string | null;
    granted_domains: CareCircleDomain[];
    status: InvitationStatus;
    created_at: string;
    expires_at: string;
  }>;
  return {
    ok: true,
    data: rows.map((row) => ({
      id: row.id,
      inviteeEmail: row.invitee_email,
      role: row.role,
      relationshipType: row.relationship_type,
      relationshipLabel: row.relationship_label ?? undefined,
      grantedDomains: row.granted_domains,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    })),
  };
}

export async function listMyInvitations(): Promise<Result<MyInvitation[]>> {
  const { data, error } = await supabase.rpc('list_my_invitations');
  if (error) return fail(error);
  const rows = (data ?? []) as Array<{
    id: string;
    care_space_id: string;
    care_space_name: string;
    invited_by_display_name: string;
    role: CareCircleRole;
    relationship_type: Relationship;
    relationship_label: string | null;
    granted_domains: CareCircleDomain[];
    created_at: string;
    expires_at: string;
  }>;
  return {
    ok: true,
    data: rows.map((row) => ({
      id: row.id,
      careSpaceId: row.care_space_id,
      careSpaceName: row.care_space_name,
      invitedByDisplayName: row.invited_by_display_name,
      role: row.role,
      relationshipType: row.relationship_type,
      relationshipLabel: row.relationship_label ?? undefined,
      grantedDomains: row.granted_domains,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    })),
  };
}

export async function inviteMember(input: {
  careSpaceId: string;
  email: string;
  role: 'contributor' | 'viewer';
  grantedDomains: CareCircleDomain[];
  relationshipType: Relationship;
  relationshipLabel?: string;
}): Promise<Result<void>> {
  const { error } = await supabase.rpc('invite_member', {
    target_care_space_id: input.careSpaceId,
    invitee_email_input: input.email.trim(),
    member_role: input.role,
    granted_domains: input.grantedDomains,
    member_relationship_type: input.relationshipType,
    member_relationship_label: input.relationshipLabel?.trim() || null,
    operation_id: createUuid(),
  });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

export async function acceptInvitation(invitationId: string): Promise<Result<string>> {
  const { data, error } = await supabase.rpc('accept_invitation', {
    target_invitation_id: invitationId,
    operation_id: createUuid(),
  });
  if (error) return fail(error);
  return { ok: true, data: data as string };
}

export async function declineInvitation(invitationId: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('decline_invitation', { target_invitation_id: invitationId });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

export async function revokeInvitation(invitationId: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('revoke_invitation', { target_invitation_id: invitationId });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

export async function changeMemberRole(input: {
  membershipId: string;
  role: CareCircleRole;
  grantedDomains: CareCircleDomain[];
}): Promise<Result<void>> {
  const { error } = await supabase.rpc('change_member_role', {
    target_membership_id: input.membershipId,
    new_role: input.role,
    new_granted_domains: input.grantedDomains,
  });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

export async function removeMember(membershipId: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('remove_member', { target_membership_id: membershipId });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

export async function leaveCareSpace(careSpaceId: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('leave_care_space', { target_care_space_id: careSpaceId });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}
