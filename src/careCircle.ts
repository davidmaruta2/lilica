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

// Shared, human-friendly labels for the five domains defined server-side by
// record_domain_for_type() -- used by both CareCircleScreen (choosing what
// to grant) and InvitationsScreen (showing what was granted).
export const DOMAIN_LABELS: Record<CareCircleDomain, string> = {
  general: 'Everyday things',
  health: 'Care & health',
  financial: 'Bills & money',
  home: 'Home & car',
  documents: 'Documents',
};

// Direct product-owner request: when choosing what a Care Circle member
// can see, name exactly what each domain covers rather than leaving the
// label to speak for itself. Every Lilica record type maps to exactly one
// of these five (record_domain_for_type() server-side, with an explicit
// else -> general catch-all) -- these descriptions are written to match
// that real mapping exactly, not a guess at it.
export const DOMAIN_DESCRIPTIONS: Record<CareCircleDomain, string> = {
  general: 'Appointments, tasks, contacts and everyday updates.',
  health: 'Care notes and health-related information.',
  financial: 'Bills and financial information.',
  home: 'Home and car matters, like repairs and maintenance.',
  documents: 'Standalone documents, and any files attached to them.',
};

export type CareCircleMember = {
  membershipId: string;
  displayName: string;
  role: CareCircleRole;
  relationshipType: Relationship;
  relationshipLabel?: string;
  isSelf: boolean;
  grantedDomains: CareCircleDomain[];
  // Direct product-owner report (14 September 2026): a fellow member's
  // real photo, not just their own. See
  // supabase/migrations/20260916150000_shared_avatar_visibility.sql --
  // readable only because this account shares an active care space with
  // them; resolved to a signed URL the same way self's own avatar
  // already was (src/profileAvatar.ts's resolveAvatarUrl(), unchanged).
  avatarPath?: string;
};

export type CareCircleInvitation = {
  id: string;
  inviteeEmail: string;
  role: CareCircleRole;
  relationshipType: Relationship;
  relationshipLabel?: string;
  grantedDomains: CareCircleDomain[];
  status: InvitationStatus;
  // Care Circle invitation & joining flow completion (`\downloads\carecircle.txt`,
  // 14 September 2026): a human-friendly locator for this SAME invitation
  // -- never a second security model. See
  // supabase/migrations/20260916140000_invitation_code.sql.
  inviteCode: string;
  // Final architectural closure (14 September 2026): server-authoritative
  // delivery state -- these are set ONLY by record_invitation_email_sent()/
  // record_invitation_share_opened() (see
  // supabase/migrations/20260916160000_invitation_delivery_and_rate_limit.sql),
  // never by the client directly, and survive app restart/reinstall/
  // device change because they live on this row, not in local storage.
  lastEmailSentAt?: string;
  emailSendCount: number;
  lastShareOpenedAt?: string;
  createdAt: string;
  expiresAt: string;
};

// Preview shape returned by resolve_invitation_by_code() -- deliberately
// minimal: never invitee_email, never care_space_id. Reaching this point
// proves nothing about identity; only accept_invitation() (unchanged)
// decides whether the authenticated caller may actually join.
export type CodeResolvedInvitation = {
  invitationId: string;
  careSpaceName: string;
  invitedByDisplayName: string;
  role: CareCircleRole;
  grantedDomains: CareCircleDomain[];
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
    avatar_path: string | null;
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
      avatarPath: row.avatar_path ?? undefined,
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
    invite_code: string;
    last_email_sent_at: string | null;
    email_send_count: number;
    last_share_opened_at: string | null;
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
      inviteCode: row.invite_code,
      lastEmailSentAt: row.last_email_sent_at ?? undefined,
      emailSendCount: row.email_send_count,
      lastShareOpenedAt: row.last_share_opened_at ?? undefined,
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

// Returns the created (or, on a retried operation_id, the existing)
// invitation's own id -- needed so the caller can immediately offer
// "Send by email"/"Share invitation" for THIS specific invitation right
// after creating it, without a second round trip.
export async function inviteMember(input: {
  careSpaceId: string;
  email: string;
  role: 'contributor' | 'viewer';
  grantedDomains: CareCircleDomain[];
  relationshipType: Relationship;
  relationshipLabel?: string;
}): Promise<Result<{ invitationId: string; inviteCode: string }>> {
  const { data, error } = await supabase.rpc('invite_member', {
    target_care_space_id: input.careSpaceId,
    invitee_email_input: input.email.trim(),
    member_role: input.role,
    granted_domains: input.grantedDomains,
    member_relationship_type: input.relationshipType,
    member_relationship_label: input.relationshipLabel?.trim() || null,
    operation_id: createUuid(),
  });
  if (error) return fail(error);
  const row = data as { id: string; invite_code: string };
  return { ok: true, data: { invitationId: row.id, inviteCode: row.invite_code } };
}

// Care Circle invitation & joining flow completion (`\downloads\carecircle.txt`,
// 14 September 2026): resolves a human-friendly invitation code to the
// SAME invitation the email/deep-link route would resolve, and a minimal
// safe preview of it -- never invitee_email, never care_space_id, never
// role/domain data the caller could alter. This does NOT create
// membership and does NOT check the caller's identity against the
// invitation -- accept_invitation() (called separately, completely
// unmodified, via the returned invitationId) remains the sole authority
// for both of those. See resolve_invitation_by_code()'s own header
// comment in the migration for the full reasoning.
// Deliberately NOT routed through fail()/friendlyAuthError('profile') --
// that helper's fallback is written for account/profile actions and
// would replace this function's own calm, specific messages ("We could
// not find an active invitation with that code", "This invitation is no
// longer active") with an unrelated generic one. Those two messages are
// resolve_invitation_by_code()'s own literal raised text -- trusted
// verbatim, since they were written to be shown directly (brief section
// 12's explicit examples). Anything else (a genuine network/server
// failure) gets one calm, honest fallback instead of the raw internal
// error.
const KNOWN_CODE_ERRORS = [
  'Enter an invitation code',
  'We could not find an active invitation with that code',
  'This invitation is no longer active',
  'Too many attempts. Please wait a few minutes and try again.',
];

// Final architectural closure (14 September 2026): rate limiting is a
// GENUINELY SEPARATE server-side RPC call, deliberately made first --
// see record_invitation_code_attempt()'s own header comment in
// supabase/migrations/20260916160000_invitation_delivery_and_rate_limit
// .sql for the real Postgres transactional-semantics reason a single
// combined call cannot work (a later "not found" raise inside
// resolve_invitation_by_code() would silently undo an earlier counter
// increment in the SAME call). Server-authoritative and cannot be
// bypassed by skipping this call client-side -- the SERVER still
// enforces its own window/count regardless of what the client does or
// doesn't call.
export async function resolveInvitationByCode(code: string): Promise<Result<CodeResolvedInvitation>> {
  const { error: attemptError } = await supabase.rpc('record_invitation_code_attempt');
  if (attemptError) {
    const message = attemptError instanceof Error ? attemptError.message : String(attemptError);
    const known = KNOWN_CODE_ERRORS.find((candidate) => message.includes(candidate));
    return { ok: false, message: known ?? "We couldn't check that code just now. Please try again." };
  }

  const { data, error } = await supabase.rpc('resolve_invitation_by_code', { code_input: code });
  if (error) {
    const message = error instanceof Error ? error.message : String(error);
    const known = KNOWN_CODE_ERRORS.find((candidate) => message.includes(candidate));
    return { ok: false, message: known ?? "We couldn't check that code just now. Please try again." };
  }
  const rows = (data ?? []) as Array<{
    id: string;
    care_space_name: string;
    invited_by_display_name: string;
    role: CareCircleRole;
    granted_domains: CareCircleDomain[];
  }>;
  const row = rows[0];
  if (!row) return { ok: false, message: 'We could not find an active invitation with that code.' };
  return {
    ok: true,
    data: {
      invitationId: row.id,
      careSpaceName: row.care_space_name,
      invitedByDisplayName: row.invited_by_display_name,
      role: row.role,
      grantedDomains: row.granted_domains ?? [],
    },
  };
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

// Phase 20D: organiser handoff -- the smallest correct half of "leave
// safely" (leave_care_space() already blocks a sole organiser from
// leaving; this is the one thing that was actually missing -- a way to
// make someone else an organiser first). See docs/PHASE_20D_ARCHITECTURE
// notes in docs/REVISION_LOG.md for the full reasoning.
export async function promoteToOrganiser(careSpaceId: string, membershipId: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('promote_to_organiser', {
    target_care_space_id: careSpaceId,
    target_membership_id: membershipId,
  });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

// Phase 20D: multi-organiser permanent-deletion consent. A sole active
// organiser is deleted immediately server-side (requestId resolves to
// undefined in that case -- there is nothing further to wait for).
export type DeletionReason = 'care_no_longer_required' | 'supported_person_requested' | 'other';

export async function requestCareSpaceDeletion(careSpaceId: string, reason?: DeletionReason): Promise<Result<{ requestId?: string; deletedImmediately: boolean }>> {
  const { data, error } = await supabase.rpc('request_care_space_deletion', {
    target_care_space_id: careSpaceId,
    deletion_reason: reason ?? null,
  });
  if (error) return fail(error);
  return { ok: true, data: { requestId: data ?? undefined, deletedImmediately: !data } };
}

export type CareSpaceDeletionStatus = {
  requestId: string;
  requestedByMembershipId: string;
  reason?: DeletionReason;
  createdAt: string;
  organiserCount: number;
  approvedCount: number;
  approvedMembershipIds: string[];
};

export async function getCareSpaceDeletionStatus(careSpaceId: string): Promise<Result<CareSpaceDeletionStatus | undefined>> {
  const { data, error } = await supabase.rpc('get_care_space_deletion_status', { target_care_space_id: careSpaceId });
  if (error) return fail(error);
  const row = (data ?? [])[0];
  if (!row) return { ok: true, data: undefined };
  return {
    ok: true,
    data: {
      requestId: row.request_id,
      requestedByMembershipId: row.requested_by_membership_id,
      reason: row.reason ?? undefined,
      createdAt: row.created_at,
      organiserCount: row.organiser_count,
      approvedCount: row.approved_count,
      approvedMembershipIds: row.approved_membership_ids ?? [],
    },
  };
}

// Returns true once every active organiser has approved and the care
// space has genuinely been permanently deleted; false while still waiting.
export async function approveCareSpaceDeletion(requestId: string): Promise<Result<boolean>> {
  const { data, error } = await supabase.rpc('approve_care_space_deletion', { target_request_id: requestId });
  if (error) return fail(error);
  return { ok: true, data: Boolean(data) };
}

export async function declineCareSpaceDeletion(requestId: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('decline_care_space_deletion', { target_request_id: requestId });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

export async function cancelCareSpaceDeletion(requestId: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('cancel_care_space_deletion', { target_request_id: requestId });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

// Care Circle invitation delivery: real transactional email via the
// send-invitation-email Edge Function (supabase/functions/send-
// invitation-email). The Supabase client automatically forwards the
// caller's own current session as the request's Authorization header --
// the function's own RLS-scoped read is the real authority check, not
// anything asserted here. Distinguishes "invitation created" (already
// true before this is ever called) from "email delivery request
// accepted" (this call's own success) -- never claims mailbox delivery
// itself, which no provider can guarantee (brief section 29). Calling
// this again for the SAME invitation (a genuine resend, or a retry after
// a failed attempt) never creates a second invitation -- it only ever
// re-sends the one row that already exists.
export async function sendInvitationEmail(invitationId: string): Promise<Result<void>> {
  const { data, error } = await supabase.functions.invoke('send-invitation-email', {
    body: { invitationId },
  });
  if (error) {
    // FunctionsHttpError (a real 4xx/5xx from the function) carries the
    // function's own JSON body on `error.context` in some client
    // versions; fall back to a calm, honest default rather than a raw
    // technical message.
    const message = (data as { message?: string } | null)?.message
      ?? "The invitation was created, but the email couldn't be sent.";
    return { ok: false, message };
  }
  if (data && (data as { ok?: boolean }).ok === false) {
    return { ok: false, message: (data as { message?: string }).message ?? "The invitation was created, but the email couldn't be sent." };
  }
  return { ok: true, data: undefined };
}

// Final architectural closure (14 September 2026): records that Lilica
// itself genuinely handed the invitation to the OS native share sheet
// without a reported cancellation -- called by CareCircleScreen.tsx
// ONLY after a non-cancelled Share.share() result, mirroring exactly
// what the send-invitation-email Edge Function does server-side for
// email (this is the client-driven equivalent, since native Share has
// no server round trip of its own). Never claims recipient delivery or
// read -- only that the hand-off itself happened.
export async function recordInvitationShareOpened(invitationId: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('record_invitation_share_opened', { target_invitation_id: invitationId });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}
