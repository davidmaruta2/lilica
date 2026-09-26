-- Real-device bug, 26 September 2026: deleting an account failed with
-- "update or delete on table 'users' violates foreign key constraint"
-- the moment delete_my_account() tried to delete the caller's auth.users
-- row. Root cause: care_space_invitation_groups.invited_by_user_id
-- (added 17 September 2026, 20260917090000_multi_person_invitation_groups.sql)
-- references auth.users(id) ON DELETE RESTRICT directly -- the one place
-- in this schema that didn't follow the established pattern every other
-- inviter/creator reference already uses (care_space_invitations'
-- own invited_by_membership_id, care_spaces' bootstrap_owner_id/
-- commercial_owner_id: reference membership.id or be nullable-and-
-- detached, never a hard, undetached reference to the live auth
-- identity). delete_my_account() was never updated for this column when
-- it was added, since nothing else in the function's own history
-- touched this table. Confirmed via grep across every migration: nothing
-- else reads invited_by_user_id (no RLS policy references it -- the
-- table is force-RLS with zero policies, access is entirely through
-- this migration's own security-definer functions -- and no other
-- function selects it), so detaching it is exactly as safe as detaching
-- bootstrap_owner_id/commercial_owner_id already is.

alter table public.care_space_invitation_groups
  alter column invited_by_user_id drop not null;

comment on column public.care_space_invitation_groups.invited_by_user_id is
  'The live auth identity that created this invitation group, or null once that identity has deleted their Lilica account (see delete_my_account()). Purely informational -- no RLS policy or function reads it for authorisation; the group row itself, and every invitation it produced, is unaffected by this detaching.';

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_membership_ids uuid[];
  caller_display_name text;
begin
  if caller_id is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Idempotency: a retry against an identity already deleted (e.g. the
  -- client never saw the first call's response) is a safe, silent
  -- no-op -- the terminal state is already reached, nothing to redo.
  if not exists (select 1 from auth.users where id = caller_id) then
    return;
  end if;

  select array_agg(id) into caller_membership_ids
  from public.care_space_memberships
  where user_id = caller_id;

  select display_name into caller_display_name from public.profiles where id = caller_id;

  -- Snapshot + detach every membership this identity holds, whatever its
  -- current status (active or already-revoked-but-still-live-user_id).
  -- Data minimisation: only a short display-name snapshot is retained,
  -- never the email/login identity that is about to be deleted. This
  -- includes a sole-organiser membership -- no longer refused above.
  update public.care_space_memberships
  set former_display_name = coalesce(nullif(btrim(caller_display_name), ''), 'Former member'),
      membership_status = 'former',
      user_id = null
  where id = any(coalesce(caller_membership_ids, '{}'::uuid[]));

  -- Detach the second, separate auth.users reference (see the Phase 18B
  -- migration header comment) -- never deletes the care_spaces row itself.
  update public.care_spaces
  set bootstrap_owner_id = null
  where bootstrap_owner_id = caller_id;

  -- Phase 21B: detach commercial ownership too, on exactly the same
  -- nullable-on-delete pattern -- a care space this account commercially
  -- owned becomes unowned (effectively read-only, per
  -- care_space_has_active_entitlement()'s own coalesce-to-false handling
  -- of a null commercial_owner_id) unless another active organiser
  -- explicitly claims it via transfer_care_space_commercial_ownership()
  -- before or after this deletion. Never silently reassigned. This is
  -- the mechanism behind the warning's "closes the care circle" -- other
  -- members' own memberships stay active and every already-shared record
  -- remains readable, but no further gated mutation succeeds for anyone
  -- until a remaining organiser claims commercial ownership themselves
  -- (which requires their own active entitlement).
  update public.care_spaces set commercial_owner_id = null where commercial_owner_id = caller_id;

  -- Revoke this account's own still-pending SENT invitations only.
  -- Already-accepted memberships (now former, above) and invitations
  -- created by other organisers are untouched.
  update public.care_space_invitations
  set status = 'revoked', responded_at = statement_timestamp()
  where status = 'pending'
    and invited_by_membership_id = any(coalesce(caller_membership_ids, '{}'::uuid[]));

  -- 26 September 2026 fix: detach this account's own invitation GROUPS
  -- (see this migration's header) -- the real, missing piece that made
  -- deletion fail outright. Purely informational metadata, safe to null;
  -- the group and every invitation it produced are otherwise untouched
  -- (already-pending child invitations are still revoked above via their
  -- own invited_by_membership_id, independent of this).
  update public.care_space_invitation_groups
  set invited_by_user_id = null
  where invited_by_user_id = caller_id;

  -- Records/occurrences/assignments/record_links/record_attachments all
  -- reference membership.id, never user_id -- untouched by the above,
  -- and never touched here. No device-registration or server-side
  -- reminder/notification table exists in this schema (Phase 14 is
  -- local-device-only by design -- see docs/PHASE_14_ARCHITECTURE.md),
  -- so there is nothing further to revoke server-side for those; the
  -- client clears its own local reminder/notification state after this
  -- call succeeds (see src/accountLifecycle.ts).

  -- Phase 21B: the entitlement row is account-scoped personal commercial
  -- data, not shared care-space history -- removed outright here rather
  -- than left for the on-delete-cascade below, so it is gone even if a
  -- future change ever detaches auth.users deletion from this function.
  -- The audit trail (entitlement_events) survives with user_id set to
  -- null by its own on-delete-set-null FK, preserving minimal
  -- provider-transaction evidence without retaining it against a live
  -- account (see docs/PHASE_21_ARCHITECTURE.md's retention policy).
  delete from public.entitlements where user_id = caller_id;

  -- profiles.id references auth.users(id) on delete cascade (Phase 5) --
  -- deleting the auth identity below removes the live profile row too;
  -- deleting it a second time here would be duplicate logic, not defence
  -- in depth.
  delete from auth.users where id = caller_id;
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Phase 18B/21B/26-Sep-2026: deletes the CALLING user''s own auth identity (derived from auth.uid() only -- never a caller-supplied id). Does not refuse a sole active organiser (David''s explicit product decision, 26 September 2026). Detaches (never deletes) every membership they hold, snapshotting a minimal display name and marking it former; detaches bootstrap_owner_id/commercial_owner_id on care spaces they held and invited_by_user_id on invitation groups they created (the 26 September fix -- this last one previously raised a foreign key violation and blocked deletion outright for any account that had ever created a multi-person invitation group); revokes their own pending sent invitations; removes their entitlement row; then deletes the auth.users row, which cascades to their profile. Idempotent -- a retry after the identity is already gone is a safe no-op. account_deletion_precheck() is unchanged and remains purely informational for the client''s confirmation copy.';
