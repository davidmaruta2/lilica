-- Care Circle invitation system final architectural closure (14 September
-- 2026, GPT/product-owner review): two corrections.
--
-- ISSUE ONE: invitation delivery state was device-local only
-- (LocalCareSpaceState.invitationDeliveryStatus/AsyncStorage) -- correct
-- for a genuinely transient in-flight/failure state, but NOT acceptable
-- as the durable source of truth for something Lilica itself already
-- knows server-side (whether it successfully submitted the email to
-- Resend). Fixed with the smallest additive extension: three new
-- columns on the EXISTING care_space_invitations row -- no new table,
-- no second delivery subsystem.
--
-- ISSUE TWO: resolve_invitation_by_code() had no rate limiting -- an
-- authenticated account could make unlimited rapid guesses. Fixed with
-- a small database-backed sliding-window counter, server-authoritative,
-- scoped per account, cannot be bypassed by clearing local storage.

-- ---------------------------------------------------------------------
-- 1. Delivery state -- additive columns only.
-- ---------------------------------------------------------------------
alter table public.care_space_invitations
  add column last_email_sent_at timestamptz,
  add column email_send_count integer not null default 0,
  add column last_share_opened_at timestamptz;

-- record_invitation_email_sent(): called ONLY by the send-invitation-
-- email Edge Function, ONLY after Resend has genuinely accepted the
-- send request -- never before, never on a failed send. Organiser-only
-- (same boundary invite_member/list_care_space_invitations already
-- use), so a caller cannot mark an invitation they don't organise as
-- emailed.
create function public.record_invitation_email_sent(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.care_space_invitations invitation
  set last_email_sent_at = now(),
      email_send_count = invitation.email_send_count + 1
  where invitation.id = target_invitation_id
    and exists (
      select 1 from public.care_space_memberships organiser_membership
      where organiser_membership.care_space_id = invitation.care_space_id
        and organiser_membership.user_id = (select auth.uid())
        and organiser_membership.role = 'organiser'
        and organiser_membership.membership_status = 'active'
    );

  if not found then
    raise exception 'Invitation not found' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.record_invitation_email_sent(uuid) from public;
revoke all on function public.record_invitation_email_sent(uuid) from anon;
grant execute on function public.record_invitation_email_sent(uuid) to authenticated;

-- record_invitation_share_opened(): called by the CLIENT after a
-- genuinely non-cancelled native Share result -- see
-- src/screens/CareCircleScreen.tsx. Records only that Lilica itself
-- handed the content to the OS share sheet without a reported
-- cancellation -- never recipient delivery or read. Same organiser-only
-- boundary as email.
create function public.record_invitation_share_opened(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.care_space_invitations invitation
  set last_share_opened_at = now()
  where invitation.id = target_invitation_id
    and exists (
      select 1 from public.care_space_memberships organiser_membership
      where organiser_membership.care_space_id = invitation.care_space_id
        and organiser_membership.user_id = (select auth.uid())
        and organiser_membership.role = 'organiser'
        and organiser_membership.membership_status = 'active'
    );

  if not found then
    raise exception 'Invitation not found' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.record_invitation_share_opened(uuid) from public;
revoke all on function public.record_invitation_share_opened(uuid) from anon;
grant execute on function public.record_invitation_share_opened(uuid) to authenticated;

-- list_care_space_invitations() redefined (shape change) to also
-- surface these three organiser-visible fields -- the ONLY reason it
-- changes; its own authority/filter logic is otherwise identical.
drop function if exists public.list_care_space_invitations(uuid);

create function public.list_care_space_invitations(target_care_space_id uuid)
returns table (
  id uuid,
  invitee_email text,
  role text,
  relationship_type text,
  relationship_label text,
  granted_domains text[],
  status text,
  invite_code text,
  last_email_sent_at timestamptz,
  email_send_count integer,
  last_share_opened_at timestamptz,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.care_space_memberships membership
    where membership.care_space_id = target_care_space_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'organiser'
      and membership.membership_status = 'active'
  ) then
    raise exception 'Only an active organiser can view invitations' using errcode = '42501';
  end if;

  return query
  select
    invitation.id, invitation.invitee_email, invitation.role,
    invitation.relationship_type, invitation.relationship_label,
    invitation.granted_domains, invitation.status, invitation.invite_code,
    invitation.last_email_sent_at, invitation.email_send_count, invitation.last_share_opened_at,
    invitation.created_at, invitation.expires_at
  from public.care_space_invitations invitation
  where invitation.care_space_id = target_care_space_id
  order by invitation.created_at desc;
end;
$$;

revoke all on function public.list_care_space_invitations(uuid) from public;
revoke all on function public.list_care_space_invitations(uuid) from anon;
grant execute on function public.list_care_space_invitations(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Rate limiting for resolve_invitation_by_code() -- a small,
--    database-backed sliding-window counter. No Redis/external
--    infrastructure. Not directly readable/writable by any client --
--    only resolve_invitation_by_code() itself (SECURITY DEFINER) ever
--    touches it, so it cannot be bypassed by clearing local storage or
--    reinstalling.
-- ---------------------------------------------------------------------
create table public.invitation_code_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  attempt_count integer not null default 0
);

alter table public.invitation_code_attempts enable row level security;
alter table public.invitation_code_attempts force row level security;
-- Deliberately NO policies at all -- not even the owning user can read
-- or write this directly; only the SECURITY DEFINER function below can,
-- since it runs as the table owner and RLS does not apply to it.

-- Thresholds, chosen and documented rather than arbitrary: 10 attempts
-- per rolling 5-minute window per account. Generous enough that a real
-- person correcting typos is never blocked (a human is not going to
-- mistype a code 10 times in 5 minutes), tight enough that automated
-- guessing against the ~1.1 trillion-value code space is not
-- economically useful (10 guesses / 5 min = ~2,880/day, versus a
-- keyspace of 32^8).
--
-- DELIBERATELY A SEPARATE RPC, not folded into resolve_invitation_by_
-- code() itself -- a real Postgres transactional-semantics constraint,
-- not a style preference. resolve_invitation_by_code() communicates
-- "not found"/"no longer active" by RAISING an exception (so the
-- client's existing message-matching keeps working unchanged); but
-- when a single function raises an exception, Postgres rolls back
-- EVERYTHING that function did in that same call -- including a
-- counter increment performed earlier in the SAME function body. That
-- would make the rate limiter silently no-op for exactly the case it
-- exists to catch (repeated WRONG guesses, each of which raises "not
-- found"). Splitting the throttle check into its own RPC call means it
-- commits (or raises "too many attempts" -- itself before any
-- increment, so nothing to lose) as its own independent transaction,
-- entirely unaffected by whatever the FOLLOWING resolve call does.
-- The client (src/careCircle.ts) calls this first, then only proceeds
-- to resolve_invitation_by_code() if it succeeds.
create function public.record_invitation_code_attempt()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_seconds constant int := 300;
  max_attempts constant int := 10;
  existing_attempt public.invitation_code_attempts%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into existing_attempt
  from public.invitation_code_attempts
  where user_id = (select auth.uid())
  for update;

  if not found then
    insert into public.invitation_code_attempts (user_id, window_start, attempt_count)
    values ((select auth.uid()), now(), 1);
  elsif existing_attempt.window_start <= now() - (window_seconds || ' seconds')::interval then
    update public.invitation_code_attempts
    set window_start = now(), attempt_count = 1
    where user_id = (select auth.uid());
  elsif existing_attempt.attempt_count >= max_attempts then
    -- Deliberately NOT 'P0004' -- that is Postgres's own reserved
    -- assert_failure SQLSTATE, which "WHEN OTHERS" explicitly does NOT
    -- catch (a real bug found by this migration's own pgTAP test,
    -- which needs to catch this exception directly). Left as the
    -- plain default (P0001, raise_exception) like every other custom
    -- raise in this file that doesn't need a specific errcode.
    raise exception 'Too many attempts. Please wait a few minutes and try again.';
  else
    update public.invitation_code_attempts
    set attempt_count = attempt_count + 1
    where user_id = (select auth.uid());
  end if;
end;
$$;

revoke all on function public.record_invitation_code_attempt() from public;
revoke all on function public.record_invitation_code_attempt() from anon;
grant execute on function public.record_invitation_code_attempt() to authenticated;

create or replace function public.resolve_invitation_by_code(code_input text)
returns table (
  id uuid,
  care_space_name text,
  invited_by_display_name text,
  role text,
  granted_domains text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalised_code text;
  invitation public.care_space_invitations%rowtype;
  person_name text;
  inviter_name text;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  normalised_code := upper(regexp_replace(coalesce(code_input, ''), '[^A-Za-z0-9]', '', 'g'));
  if normalised_code = '' then
    raise exception 'Enter an invitation code' using errcode = '22023';
  end if;

  update public.care_space_invitations inv
  set status = 'expired'
  where inv.invite_code = normalised_code
    and inv.status = 'pending'
    and inv.expires_at <= now();

  select * into invitation
  from public.care_space_invitations
  where invite_code = normalised_code;

  if not found then
    raise exception 'We could not find an active invitation with that code' using errcode = 'P0002';
  end if;

  if invitation.status <> 'pending' then
    raise exception 'This invitation is no longer active' using errcode = 'P0003';
  end if;

  select display_name into person_name
  from public.supported_people
  where care_space_id = invitation.care_space_id;

  select profile.display_name into inviter_name
  from public.care_space_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  where membership.id = invitation.invited_by_membership_id;

  return query
  select
    invitation.id,
    coalesce(person_name, 'a Lilica care space'),
    coalesce(inviter_name, 'The organiser'),
    invitation.role,
    invitation.granted_domains;
end;
$$;

revoke all on function public.resolve_invitation_by_code(text) from public;
revoke all on function public.resolve_invitation_by_code(text) from anon;
grant execute on function public.resolve_invitation_by_code(text) to authenticated;
