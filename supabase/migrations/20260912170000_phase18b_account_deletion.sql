-- Phase 18B: Account Deletion & Complete Data Export (Downloads\18b.txt).
--
-- Phase 18A investigated and reported, rather than worked around, a real
-- architectural blocker: care_space_memberships.user_id references
-- auth.users(id) on delete restrict, and membership rows are themselves
-- permanently referenced (also on delete restrict) from records,
-- occurrences, assignments, record_links, record_attachments and
-- mutation-receipt tables -- by design, to preserve historical
-- attribution. That investigation's own conclusion was that real account
-- deletion needs a separately-approved schema change decoupling the LIVE
-- AUTH IDENTITY from the STABLE HISTORICAL MEMBERSHIP IDENTITY. This
-- migration is that approved change -- the smallest one that satisfies it:
--
--   * care_space_memberships.user_id becomes NULLABLE. A membership row
--     is NEVER deleted or re-created for this -- its id, and every
--     foreign key across the schema that already points at that id,
--     stays exactly as valid as it always was. Only user_id is detached.
--   * care_space_memberships.former_display_name captures a minimal,
--     human-readable historical snapshot (never an email, never a login
--     identity) at the moment of detachment, so existing history stays
--     truthful ("David M") rather than degrading into "Unknown".
--   * membership_status gains a third value, 'former', alongside the
--     existing 'active'/'revoked' -- and because EVERY existing access
--     check in this schema already requires membership_status = 'active'
--     (can_access_care_space_records, membership_has_domain_access, and
--     every RLS policy built on them), a former membership is denied
--     access everywhere, automatically, with zero new RLS logic.
--   * protect_membership_identity() (the trigger making care_space_id/
--     user_id/bootstrap_id immutable) is extended to allow exactly one
--     new transition: a live user_id detaching to null. It still refuses
--     reassignment to a different user, and refuses ever re-attaching a
--     detached membership to a live identity again.
--   * delete_my_account(): the real, secure, server-side deletion
--     operation. security definer, derives its target exclusively from
--     auth.uid() (never accepts a caller-supplied id), re-runs the
--     sole-organiser safety check itself (never trusts a client-side
--     precheck alone), snapshots+detaches every membership the caller
--     holds, marks them 'former', revokes the caller's own still-pending
--     sent invitations, and only then deletes the auth.users row itself
--     (this project has no separate Edge Function/service-role backend,
--     so a security-definer Postgres function -- the standard pattern for
--     self-serve deletion in a client-only Supabase app -- is the
--     narrowest secure mechanism available; see
--     docs/PHASE_18_ARCHITECTURE.md's Phase 18B addendum for the full
--     sequence and the alternative considered). profiles.id already
--     references auth.users(id) on delete cascade (Phase 5), so the live
--     profile row is removed by that existing cascade, not duplicated
--     logic here. Idempotent: a retry against an identity that no longer
--     exists in auth.users is a safe, silent no-op.
--   * resolve_membership_identities(): a small, new, read-only function
--     letting a client resolve a SPECIFIC set of membership ids (e.g. an
--     assignee or a document's creator) to a display name, scoped to
--     memberships in a care space the caller is themselves an active
--     member of. A former membership resolves to its snapshot ("David M
--     · Former member" is composed client-side from the returned
--     is_former flag); this is what lets RecordDetail/ToDoScreen show
--     truthful historical attribution instead of silently rendering
--     nothing once a former member drops out of the active member list.
--
-- Nothing about account_deletion_precheck() or export_my_data() changes
-- in this migration -- both are reused exactly as Phase 18A shipped them.
-- Complete-document-file export (18b.txt section 30) is implemented
-- entirely client-side (src/accountLifecycle.ts), reusing the existing
-- record_attachments SELECT RLS and the private document-attachments
-- Storage bucket's existing read policy -- both already scope to exactly
-- what the caller is authorised to see, so no new schema/RPC was needed
-- for it.

-- ---------------------------------------------------------------------
-- 1. Membership/auth decoupling.
-- ---------------------------------------------------------------------

alter table public.care_space_memberships
  alter column user_id drop not null;

-- care_spaces.bootstrap_owner_id is a second, separate on-delete-restrict
-- reference to auth.users(id) -- distinct from membership.user_id, and
-- missed by Phase 18A's own investigation (which only looked at
-- membership). Its own comment already establishes it as "idempotency
-- metadata only; access is granted exclusively through membership" -- so
-- detaching it (never deleting the care_spaces row itself) is exactly as
-- safe as detaching membership.user_id, and for the same reason: nothing
-- reads it for access control.
alter table public.care_spaces
  alter column bootstrap_owner_id drop not null;

comment on column public.care_spaces.bootstrap_owner_id is
  'Idempotency metadata only; access is granted exclusively through membership. Set to null once that identity deletes their Lilica account (see delete_my_account()) -- the care_spaces row itself is never deleted for this.';

alter table public.care_space_memberships
  add column former_display_name text,
  add constraint care_space_memberships_former_display_name check (
    former_display_name is null or char_length(btrim(former_display_name)) between 1 and 100
  );

alter table public.care_space_memberships
  drop constraint care_space_memberships_status;

alter table public.care_space_memberships
  add constraint care_space_memberships_status
    check (membership_status in ('active', 'revoked', 'former'));

-- A membership is either live (a real auth identity, no snapshot yet
-- needed) or former (detached, identity gone, snapshot required) --
-- never both, never neither.
alter table public.care_space_memberships
  add constraint care_space_memberships_former_shape check (
    (membership_status = 'former' and user_id is null and former_display_name is not null)
    or (membership_status <> 'former' and user_id is not null)
  );

-- Extends Phase 15's own version of this trigger (which already made
-- role a legitimate, gated transition rather than immutable). user_id
-- may now ALSO transition, but in exactly one direction and exactly
-- once: a live identity detaching to null. It can never be reassigned to
-- a different live user, and a detached (null) membership can never be
-- reattached to any live identity again.
create or replace function public.protect_membership_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.care_space_id <> old.care_space_id
    or new.bootstrap_id <> old.bootstrap_id then
    raise exception 'Membership ownership identifiers are immutable' using errcode = '42501';
  end if;
  if old.user_id is not null and new.user_id is not null and new.user_id <> old.user_id then
    raise exception 'Membership ownership identifiers are immutable' using errcode = '42501';
  end if;
  if old.user_id is null and new.user_id is not null then
    raise exception 'A detached membership cannot be reattached to a live identity' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

comment on column public.care_space_memberships.user_id is
  'The live auth identity holding this membership, or null once that identity has deleted their Lilica account (see delete_my_account()). The membership row -- and every foreign key elsewhere in this schema pointing at its id -- is never deleted or regenerated for this.';
comment on column public.care_space_memberships.former_display_name is
  'A minimal historical snapshot ("David M"), captured only at account-deletion time, never an email/login identity. Null while the membership is live.';

-- ---------------------------------------------------------------------
-- 2. delete_my_account(): the real, secure, self-service deletion.
-- ---------------------------------------------------------------------

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_membership_ids uuid[];
  caller_display_name text;
  blocked_space_name text;
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

  -- Re-run the sole-organiser safety check server-side -- never trust a
  -- client-side account_deletion_precheck() call alone. Uses the exact
  -- same "count of active organisers = 1" decision that function itself
  -- makes, and the same rule leave_care_space()/remove_member() already
  -- enforce for the same underlying reason (Phase 15).
  select coalesce(person.display_name, 'A Lilica care space') into blocked_space_name
  from public.care_space_memberships m
  left join public.supported_people person on person.care_space_id = m.care_space_id
  where m.user_id = caller_id
    and m.membership_status = 'active'
    and m.role = 'organiser'
    and (
      select count(*) from public.care_space_memberships organiser_count
      where organiser_count.care_space_id = m.care_space_id
        and organiser_count.role = 'organiser'
        and organiser_count.membership_status = 'active'
    ) = 1
  limit 1;

  if blocked_space_name is not null then
    raise exception 'Cannot delete account: % still depends on you as its only organiser. Appoint another organiser first.', blocked_space_name
      using errcode = 'P0001';
  end if;

  select array_agg(id) into caller_membership_ids
  from public.care_space_memberships
  where user_id = caller_id;

  select display_name into caller_display_name from public.profiles where id = caller_id;

  -- Snapshot + detach every membership this identity holds, whatever its
  -- current status (active or already-revoked-but-still-live-user_id).
  -- Data minimisation: only a short display-name snapshot is retained,
  -- never the email/login identity that is about to be deleted.
  update public.care_space_memberships
  set former_display_name = coalesce(nullif(btrim(caller_display_name), ''), 'Former member'),
      membership_status = 'former',
      user_id = null
  where id = any(coalesce(caller_membership_ids, '{}'::uuid[]));

  -- Detach the second, separate auth.users reference (see the migration
  -- header comment) -- never deletes the care_spaces row itself.
  update public.care_spaces
  set bootstrap_owner_id = null
  where bootstrap_owner_id = caller_id;

  -- Revoke this account's own still-pending SENT invitations only.
  -- Already-accepted memberships (now former, above) and invitations
  -- created by other organisers are untouched.
  update public.care_space_invitations
  set status = 'revoked', responded_at = statement_timestamp()
  where status = 'pending'
    and invited_by_membership_id = any(coalesce(caller_membership_ids, '{}'::uuid[]));

  -- Records/occurrences/assignments/record_links/record_attachments all
  -- reference membership.id, never user_id -- untouched by the above,
  -- and never touched here. No device-registration or server-side
  -- reminder/notification table exists in this schema (Phase 14 is
  -- local-device-only by design -- see docs/PHASE_14_ARCHITECTURE.md),
  -- so there is nothing further to revoke server-side for those; the
  -- client clears its own local reminder/notification state after this
  -- call succeeds (see src/accountLifecycle.ts).

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
  'Phase 18B: deletes the CALLING user''s own auth identity (derived from auth.uid() only -- never a caller-supplied id). Refuses if they are any care space''s sole active organiser. Detaches (never deletes) every membership they hold, snapshotting a minimal display name and marking it former; revokes their own pending sent invitations; then deletes the auth.users row, which cascades to their profile. Idempotent -- a retry after the identity is already gone is a safe no-op. Shared care-space records, occurrences, assignments, documents, attachments and links are never touched by this function -- they reference membership.id, which is never deleted or regenerated.';

-- ---------------------------------------------------------------------
-- 3. resolve_membership_identities(): lets an authorised client resolve
--    a specific membership id (an assignee, a record's creator) it
--    already encountered in its own authorised data, to a truthful
--    display name -- "David M" if still live, "David M" with is_former
--    true (client renders "· Former member") once detached. Scoped to
--    memberships in a care space the caller is themselves an active
--    member of; nothing about a membership in an unrelated care space is
--    ever returned.
-- ---------------------------------------------------------------------

create function public.resolve_membership_identities(target_membership_ids uuid[])
returns table (
  membership_id uuid,
  display_name text,
  is_former boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    case
      when m.membership_status = 'former' then coalesce(m.former_display_name, 'Former member')
      else coalesce(p.display_name, 'A Lilica member')
    end,
    m.membership_status = 'former'
  from public.care_space_memberships m
  left join public.profiles p on p.id = m.user_id
  where m.id = any(target_membership_ids)
    and exists (
      select 1 from public.care_space_memberships caller
      where caller.care_space_id = m.care_space_id
        and caller.user_id = (select auth.uid())
        and caller.membership_status = 'active'
    );
$$;

revoke all on function public.resolve_membership_identities(uuid[]) from public;
revoke all on function public.resolve_membership_identities(uuid[]) from anon;
grant execute on function public.resolve_membership_identities(uuid[]) to authenticated;

comment on function public.resolve_membership_identities(uuid[]) is
  'Phase 18B: resolves a specific set of membership ids to a truthful display name (current, or a former-member snapshot), scoped to care spaces the caller is themselves an active member of. Used to show real historical attribution ("David M -- Former member") instead of silently rendering nothing once a membership drops out of the active member list.';
