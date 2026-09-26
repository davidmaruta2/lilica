-- Direct product-owner decision, 26 September 2026: a sole active
-- organiser must be ALLOWED to delete their own Lilica account, not
-- refused. delete_my_account() previously raised an exception naming the
-- dependent care space and required appointing another organiser first
-- (Phase 18B/21B). David's own words: "When the organiser wants to
-- delete, the message should be: you are the organiser, deleting your
-- account unsubscribes you to Lilica and closes the care circle... Still
-- want to delete, enter DELETE to proceed." This is a client-side warning
-- + typed-confirmation UX change (see src/screens/PrivacyDataScreen.tsx),
-- backed by this migration removing the server-side hard block that made
-- it impossible.
--
-- Nothing else about delete_my_account() changes. It already, unrelated
-- to this block, detaches care_spaces.commercial_owner_id on any care
-- space this account commercially owned (Phase 21B) -- and
-- care_space_has_active_entitlement() already coalesces a null
-- commercial_owner_id to false, which is what makes every gated mutation
-- RPC (apply_record_mutation, invite_member, upsert_record_attachment,
-- etc.) refuse for every remaining member once this happens. That
-- existing behaviour is exactly what "closes the care circle" describes
-- in the warning copy -- this migration does not need to invent new
-- closure logic, only stop refusing to reach it. Other active members'
-- own memberships, and every already-shared record/document/link, are
-- untouched and remain readable, exactly like any other care space whose
-- commercial owner's subscription has lapsed (see AGENTS.md: "Expired
-- care spaces remain readable; only approved mutation paths are gated").
--
-- account_deletion_precheck() is intentionally left completely unchanged
-- -- it remains a useful, purely informational read (which care spaces,
-- if any, this account is the sole organiser of) that the client now
-- uses to decide which confirmation copy to show, not to block anything
-- itself.

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
  'Phase 18B/21B/26-Sep-2026: deletes the CALLING user''s own auth identity (derived from auth.uid() only -- never a caller-supplied id). No longer refuses a sole active organiser (David''s explicit product decision, 26 September 2026) -- deletion always proceeds. Detaches (never deletes) every membership they hold, snapshotting a minimal display name and marking it former; detaches bootstrap_owner_id and commercial_owner_id on care spaces they held (which, if they were the sole organiser, leaves that care space commercially unowned and therefore gated from further mutation for every remaining member -- this is what "closes the care circle" means in the client''s warning copy; already-shared records/documents/links remain readable); revokes their own pending sent invitations; removes their entitlement row; then deletes the auth.users row, which cascades to their profile. Idempotent -- a retry after the identity is already gone is a safe no-op. account_deletion_precheck() is unchanged and remains purely informational for the client''s confirmation copy.';
