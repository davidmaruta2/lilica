-- Phase 20D structural closure (approved brief `\downloads\20-22.txt`):
-- ARCHIVE, tightened multi-organiser DELETE consent, and organiser HANDOFF.
-- Documents (Part D of the brief) needs no schema change at all -- it is a
-- pure client-side projection over the existing, already-permission-
-- correct `record_attachments` table (confirmed by inspection before
-- writing this migration: its own RLS policy already resolves to exactly
-- the domain-permitted, non-deleted rows a plain client select needs).
--
-- ---------------------------------------------------------------------
-- 1. ARCHIVE -- an explicit, reversible, non-destructive care-space state.
-- ---------------------------------------------------------------------
--
-- Deliberately the smallest robust state: ACTIVE/ARCHIVED only, on the
-- care_spaces row itself (the brief's own section 5 explicitly says not to
-- add a DELETED state -- permanent deletion already means the row is
-- simply gone). No new table.
alter table public.care_spaces
  add column status text not null default 'active'
  check (status in ('active', 'archived'));

comment on column public.care_spaces.status is
  'Phase 20D: ACTIVE (normal) or ARCHIVED (reversible, non-destructive -- history/records/documents/membership all preserved, hidden from normal active-person navigation, ordinary mutations blocked). Never DELETED -- permanent deletion means the row no longer exists at all (delete_care_space()).';

-- Extend care_space_activity's own event-type list for the two new
-- lifecycle events this migration introduces, plus organiser promotion --
-- the exact same constraint-drop-and-recreate technique already used
-- (Phase 20B's own migration only ever adds via a fresh CREATE, this is
-- the first time the list itself needs to grow).
alter table public.care_space_activity drop constraint care_space_activity_event_type;
alter table public.care_space_activity add constraint care_space_activity_event_type check (event_type in (
  'record_created', 'record_completed', 'record_reopened',
  'assignment_changed', 'date_changed', 'document_uploaded',
  'member_joined', 'member_left', 'member_removed',
  'care_space_archived', 'care_space_restored', 'organiser_role_granted'
));

-- Small shared helper -- read by can_access_care_space_records() below and
-- by invite_member()'s own explicit check (Care Circle invitations are a
-- separate authority path, not routed through can_access_care_space_
-- records() at all, so need their own explicit gate).
create function public.care_space_is_active(target_care_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select status = 'active' from public.care_spaces where id = target_care_space_id),
    false
  );
$$;

revoke all on function public.care_space_is_active(uuid) from public, anon;
grant execute on function public.care_space_is_active(uuid) to authenticated;

-- Central write gate: can_access_care_space_records() is already the ONE
-- choke point every record/occurrence/link/attachment mutation RPC calls
-- with requested_action = 'write' (confirmed by direct inspection of
-- every call site across every prior migration before writing this) --
-- adding the archive check HERE, once, correctly and automatically blocks
-- every one of those mutations against an archived care space server-side,
-- with no need to touch each RPC individually. Reads ('read') are
-- deliberately UNCHANGED -- archived history must stay readable (brief
-- section 7).
create or replace function public.can_access_care_space_records(
  target_care_space_id uuid,
  target_domain text,
  requested_action text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_space_memberships membership
    where membership.care_space_id = target_care_space_id
      and membership.user_id = (select auth.uid())
      and membership.membership_status = 'active'
      and public.membership_has_domain_access(membership.id, target_domain, requested_action)
      and (requested_action = 'read' or public.care_space_is_active(target_care_space_id))
  );
$$;

-- Archive: any ACTIVE organiser may archive (approved decision, brief
-- section 9 -- reversible and non-destructive, unlike permanent delete).
-- Idempotent, matching this project's established convention
-- (delete_care_space()) for a retried call against an already-terminal
-- state.
create function public.archive_care_space(target_care_space_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership public.care_space_memberships%rowtype;
  current_status text;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into caller_membership
  from public.care_space_memberships
  where care_space_id = target_care_space_id
    and user_id = (select auth.uid())
    and membership_status = 'active'
    and role = 'organiser';

  if not found then
    raise exception 'Only an active organiser of this care space can archive it' using errcode = '42501';
  end if;

  select status into current_status from public.care_spaces where id = target_care_space_id for update;
  if current_status = 'archived' then
    return; -- already archived -- safe no-op retry
  end if;

  update public.care_spaces set status = 'archived', updated_at = statement_timestamp()
  where id = target_care_space_id;

  perform public.log_care_space_activity(
    target_care_space_id, caller_membership.id, 'care_space_archived', null, 'general', '{}'::jsonb
  );
end;
$$;

revoke all on function public.archive_care_space(uuid) from public, anon;
grant execute on function public.archive_care_space(uuid) to authenticated;

-- Restore: same authority level as archive (any active organiser) --
-- reversing a reversible action never needs a HIGHER bar than taking it.
create function public.restore_care_space(target_care_space_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership public.care_space_memberships%rowtype;
  current_status text;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into caller_membership
  from public.care_space_memberships
  where care_space_id = target_care_space_id
    and user_id = (select auth.uid())
    and membership_status = 'active'
    and role = 'organiser';

  if not found then
    raise exception 'Only an active organiser of this care space can restore it' using errcode = '42501';
  end if;

  select status into current_status from public.care_spaces where id = target_care_space_id for update;
  if current_status is null then
    raise exception 'Care space not found' using errcode = '42501';
  end if;
  if current_status = 'active' then
    return; -- already active -- safe no-op retry
  end if;

  update public.care_spaces set status = 'active', updated_at = statement_timestamp()
  where id = target_care_space_id;

  perform public.log_care_space_activity(
    target_care_space_id, caller_membership.id, 'care_space_restored', null, 'general', '{}'::jsonb
  );
end;
$$;

revoke all on function public.restore_care_space(uuid) from public, anon;
grant execute on function public.restore_care_space(uuid) to authenticated;

-- invite_member(): its own explicit archive gate (not covered by
-- can_access_care_space_records() above -- Care Circle invitations are
-- governed by organiser role directly, never by a domain-grant check).
-- Placed identically to its own existing entitlement gate immediately
-- above it in the prior migration.
create or replace function public.invite_member(
  target_care_space_id uuid,
  invitee_email_input text,
  member_role text,
  granted_domains text[],
  member_relationship_type text,
  member_relationship_label text,
  operation_id uuid
)
returns public.care_space_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  normalised_email text;
  domain_value text;
  result_row public.care_space_invitations%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select id into caller_membership_id
  from public.care_space_memberships
  where care_space_id = target_care_space_id
    and user_id = (select auth.uid())
    and role = 'organiser'
    and membership_status = 'active';

  if caller_membership_id is null then
    raise exception 'Only an active organiser can invite members' using errcode = '42501';
  end if;

  if not public.care_space_has_active_entitlement(target_care_space_id) then
    raise exception 'Subscription required to continue managing this care space' using errcode = '42501';
  end if;

  if not public.care_space_is_active(target_care_space_id) then
    raise exception 'This care space is archived -- restore it first to invite new members' using errcode = '42501';
  end if;

  if member_role not in ('contributor', 'viewer') then
    raise exception 'Invitations may only offer Contributor or Viewer' using errcode = '22023';
  end if;

  if member_relationship_type is null or member_relationship_type not in
    ('Mum', 'Dad', 'Partner', 'Child', 'Grandparent', 'Other relative', 'Someone else') then
    raise exception 'Invalid relationship type' using errcode = '22023';
  end if;

  if member_relationship_type in ('Other relative', 'Someone else') then
    if char_length(btrim(coalesce(member_relationship_label, ''))) not between 1 and 50 then
      raise exception 'A short relationship label is required for this relationship type' using errcode = '22023';
    end if;
  else
    member_relationship_label := null;
  end if;

  normalised_email := lower(trim(invitee_email_input));
  if normalised_email is null or normalised_email = ''
    or normalised_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.care_space_memberships existing
    join auth.users existing_user on existing_user.id = existing.user_id
    where existing.care_space_id = target_care_space_id
      and existing.membership_status = 'active'
      and lower(existing_user.email) = normalised_email
  ) then
    raise exception 'This person already has access to this care space' using errcode = '22023';
  end if;

  if granted_domains is null then
    granted_domains := '{}';
  end if;
  foreach domain_value in array granted_domains loop
    if domain_value not in ('general', 'health', 'financial', 'home', 'documents') then
      raise exception 'Invalid domain in grant list' using errcode = '22023';
    end if;
  end loop;

  insert into public.care_space_invitations (
    care_space_id, invited_by_membership_id, invitee_email, role,
    relationship_type, relationship_label, granted_domains, operation_id
  ) values (
    target_care_space_id, caller_membership_id, normalised_email, member_role,
    member_relationship_type, member_relationship_label, granted_domains, operation_id
  )
  on conflict (care_space_id, lower(invitee_email)) where status = 'pending'
  do update set
    role = excluded.role,
    relationship_type = excluded.relationship_type,
    relationship_label = excluded.relationship_label,
    granted_domains = excluded.granted_domains,
    operation_id = excluded.operation_id,
    expires_at = statement_timestamp() + interval '14 days'
  returning * into result_row;

  return result_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. ORGANISER HANDOFF -- promote another active member to organiser.
-- ---------------------------------------------------------------------
--
-- Deliberately just the promotion half: leave_care_space() (Phase 15/20B)
-- ALREADY blocks the sole organiser from leaving (confirmed by inspection
-- -- "Make someone else an organiser before you leave"), so once this
-- promotion exists, the existing leave flow already lets the original
-- organiser leave safely. No new "handoff" transaction is needed beyond
-- this promotion RPC and the commercial-ownership check below.
create function public.promote_to_organiser(target_care_space_id uuid, target_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_active_organiser boolean;
  target_membership public.care_space_memberships%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.care_space_memberships m
    where m.care_space_id = target_care_space_id
      and m.user_id = (select auth.uid())
      and m.role = 'organiser'
      and m.membership_status = 'active'
  ) into caller_is_active_organiser;

  if not caller_is_active_organiser then
    raise exception 'Only an active organiser can promote another member' using errcode = '42501';
  end if;

  -- Server-authoritative eligible-target check (brief section 20): must be
  -- a currently ACTIVE member of THIS SAME care space -- a former member,
  -- a removed member, a pending invitation, or a non-member id all
  -- correctly fail this lookup (no separate exclusion list needed; the
  -- inclusion criteria alone is sufficient).
  select * into target_membership
  from public.care_space_memberships
  where id = target_membership_id
    and care_space_id = target_care_space_id
    and membership_status = 'active'
  for update;

  if not found then
    raise exception 'That person is not currently an active member of this care space' using errcode = '22023';
  end if;

  if target_membership.role = 'organiser' then
    return; -- already an organiser -- safe no-op
  end if;

  update public.care_space_memberships set role = 'organiser' where id = target_membership_id;

  perform public.log_care_space_activity(
    target_care_space_id, target_membership_id, 'organiser_role_granted', null, 'general', '{}'::jsonb
  );
end;
$$;

revoke all on function public.promote_to_organiser(uuid, uuid) from public, anon;
grant execute on function public.promote_to_organiser(uuid, uuid) to authenticated;

-- leave_care_space(): one new check added -- an organiser who is ALSO the
-- care space's commercial_owner_id must resolve commercial ownership
-- (transfer it, via Phase 21B's existing transfer_care_space_commercial_
-- ownership()) BEFORE they can leave, regardless of how many other
-- organisers already exist (brief section 22 -- this is a distinct
-- invariant from "a care space must always keep an organiser", already
-- enforced below unchanged). Never redesigns billing -- reuses the exact
-- existing commercial_owner_id column and transfer RPC.
create or replace function public.leave_care_space(target_care_space_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership public.care_space_memberships%rowtype;
  organiser_count integer;
  is_commercial_owner boolean;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into caller_membership
  from public.care_space_memberships
  where care_space_id = target_care_space_id
    and user_id = (select auth.uid())
    and membership_status = 'active'
  for update;

  if not found then
    raise exception 'Membership not found' using errcode = '42501';
  end if;

  -- Organiser-count invariant checked FIRST -- it is the more fundamental
  -- blocker (no other check can be satisfied while it holds), so a sole
  -- organiser who also happens to be the commercial owner (the default
  -- for every care space at creation -- Phase 21B) sees the more useful,
  -- more fundamental message rather than being told to resolve commercial
  -- ownership first when they would still be blocked afterward anyway.
  if caller_membership.role = 'organiser' then
    select count(*) into organiser_count
    from public.care_space_memberships
    where care_space_id = target_care_space_id
      and role = 'organiser'
      and membership_status = 'active';

    if organiser_count <= 1 then
      raise exception 'Make someone else an organiser before you leave, so this care space is never left without one' using errcode = '22023';
    end if;
  end if;

  select (commercial_owner_id = (select auth.uid())) into is_commercial_owner
  from public.care_spaces where id = target_care_space_id;

  if coalesce(is_commercial_owner, false) then
    raise exception 'Transfer commercial ownership of this care space to another organiser before you leave' using errcode = '22023';
  end if;

  update public.care_space_memberships
  set membership_status = 'revoked'
  where id = caller_membership.id;

  perform public.log_care_space_activity(
    target_care_space_id, caller_membership.id, 'member_left', null, 'general', '{}'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 3. MULTI-ORGANISER DELETE CONSENT -- tightens delete_care_space()'s own
--    authority model. A sole active organiser is unaffected (brief
--    section 15: no new bureaucracy). Two ephemeral workflow tables --
--    deliberately ON DELETE CASCADE (unlike almost everything else in
--    this schema): this is transient approval state, not permanent
--    historical audit data, and it is cleanly erased the moment the care
--    space itself is deleted or a request is declined/cancelled.
-- ---------------------------------------------------------------------

create table public.care_space_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  care_space_id uuid not null references public.care_spaces (id) on delete cascade,
  requested_by_membership_id uuid not null references public.care_space_memberships (id),
  -- Contextual/audit metadata only (brief section 16) -- never presented
  -- or treated anywhere as legal consent evidence.
  reason text check (reason in ('care_no_longer_required', 'supported_person_requested', 'other')),
  created_at timestamptz not null default statement_timestamp(),
  constraint care_space_deletion_requests_one_pending_per_space
    unique (care_space_id)
);

comment on table public.care_space_deletion_requests is
  'Phase 20D: one pending permanent-deletion request per care space at a time. Ephemeral workflow state, not a permanent audit record -- cascades away the moment the care space is deleted, declined, or cancelled.';

create table public.care_space_deletion_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.care_space_deletion_requests (id) on delete cascade,
  membership_id uuid not null references public.care_space_memberships (id),
  approved_at timestamptz not null default statement_timestamp(),
  constraint care_space_deletion_approvals_one_per_member unique (request_id, membership_id)
);

alter table public.care_space_deletion_requests enable row level security;
alter table public.care_space_deletion_requests force row level security;
alter table public.care_space_deletion_approvals enable row level security;
alter table public.care_space_deletion_approvals force row level security;
revoke all on table public.care_space_deletion_requests from anon, authenticated;
revoke all on table public.care_space_deletion_approvals from anon, authenticated;
grant select on table public.care_space_deletion_requests to authenticated;
grant select on table public.care_space_deletion_approvals to authenticated;

-- Only active organisers of the care space in question may see a deletion
-- request/its approvals at all -- exactly the same authority level as
-- everything else about this decision.
create policy "active organisers can read their care space's deletion request"
on public.care_space_deletion_requests for select to authenticated
using (
  exists (
    select 1 from public.care_space_memberships m
    where m.care_space_id = care_space_deletion_requests.care_space_id
      and m.user_id = (select auth.uid())
      and m.role = 'organiser'
      and m.membership_status = 'active'
  )
);

create policy "active organisers can read their care space's deletion approvals"
on public.care_space_deletion_approvals for select to authenticated
using (
  exists (
    select 1 from public.care_space_deletion_requests req
    join public.care_space_memberships m on m.care_space_id = req.care_space_id
    where req.id = care_space_deletion_approvals.request_id
      and m.user_id = (select auth.uid())
      and m.role = 'organiser'
      and m.membership_status = 'active'
  )
);

-- request_care_space_deletion(): a sole active organiser is deleted
-- IMMEDIATELY (delegates straight to the existing, unmodified deletion
-- machinery) -- no request row is ever created for that case, matching
-- brief section 15's "do not introduce unnecessary approval bureaucracy".
-- With multiple active organisers, creates a request (the requester's own
-- approval counts automatically, brief section 12) and returns its id.
create function public.request_care_space_deletion(target_care_space_id uuid, deletion_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership public.care_space_memberships%rowtype;
  organiser_count integer;
  new_request_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into caller_membership
  from public.care_space_memberships
  where care_space_id = target_care_space_id
    and user_id = (select auth.uid())
    and membership_status = 'active'
    and role = 'organiser';

  if not found then
    raise exception 'Only an active organiser of this care space can request its removal' using errcode = '42501';
  end if;

  if deletion_reason is not null and deletion_reason not in ('care_no_longer_required', 'supported_person_requested', 'other') then
    raise exception 'Invalid reason' using errcode = '22023';
  end if;

  select count(*) into organiser_count
  from public.care_space_memberships
  where care_space_id = target_care_space_id and role = 'organiser' and membership_status = 'active';

  if organiser_count <= 1 then
    -- Sole organiser: delete immediately via the existing, unmodified,
    -- already-tested machinery. No request/approval row is ever created.
    -- Deliberately NOT setting the consensus-bypass flag here -- if
    -- another organiser was added in the narrow window between the count
    -- check above and this call (a race), delete_care_space()'s own
    -- internal, freshly-re-queried organiser count must be the one
    -- authority that decides, never a client- or caller-side assumption
    -- (brief section 15: "never trust a client-supplied flag").
    perform public.delete_care_space(target_care_space_id);
    return null;
  end if;

  insert into public.care_space_deletion_requests (care_space_id, requested_by_membership_id, reason)
  values (target_care_space_id, caller_membership.id, deletion_reason)
  on conflict (care_space_id) do update set care_space_id = excluded.care_space_id
  returning id into new_request_id;

  -- The requester's own approval counts automatically (brief section 12).
  insert into public.care_space_deletion_approvals (request_id, membership_id)
  values (new_request_id, caller_membership.id)
  on conflict (request_id, membership_id) do nothing;

  return new_request_id;
end;
$$;

revoke all on function public.request_care_space_deletion(uuid, text) from public, anon;
grant execute on function public.request_care_space_deletion(uuid, text) to authenticated;

-- approve_care_space_deletion(): records one more organiser's approval;
-- once every currently-active organiser has approved, performs the actual
-- deletion via the existing delete_care_space() machinery (which then
-- cascades away the request/approval rows as part of deleting the whole
-- care_spaces row -- no separate cleanup needed).
create function public.approve_care_space_deletion(target_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.care_space_deletion_requests%rowtype;
  caller_membership_id uuid;
  organiser_count integer;
  approval_count integer;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into request_row from public.care_space_deletion_requests where id = target_request_id for update;
  if not found then
    raise exception 'This removal request no longer exists' using errcode = '42501';
  end if;

  select id into caller_membership_id
  from public.care_space_memberships
  where care_space_id = request_row.care_space_id
    and user_id = (select auth.uid())
    and role = 'organiser'
    and membership_status = 'active';

  if caller_membership_id is null then
    raise exception 'Only an active organiser of this care space can approve its removal' using errcode = '42501';
  end if;

  insert into public.care_space_deletion_approvals (request_id, membership_id)
  values (target_request_id, caller_membership_id)
  on conflict (request_id, membership_id) do nothing;

  select count(*) into organiser_count
  from public.care_space_memberships
  where care_space_id = request_row.care_space_id and role = 'organiser' and membership_status = 'active';

  select count(*) into approval_count
  from public.care_space_deletion_approvals a
  join public.care_space_memberships m on m.id = a.membership_id
  where a.request_id = target_request_id
    and m.role = 'organiser'
    and m.membership_status = 'active';

  if approval_count >= organiser_count then
    perform set_config('lilica.deletion_consensus_reached', 'true', true);
    perform public.delete_care_space(request_row.care_space_id);
    perform set_config('lilica.deletion_consensus_reached', 'false', true);
    return true; -- deleted
  end if;

  return false; -- still waiting on someone else
end;
$$;

revoke all on function public.approve_care_space_deletion(uuid) from public, anon;
grant execute on function public.approve_care_space_deletion(uuid) to authenticated;

-- decline_care_space_deletion(): any active organiser (not only the
-- requester) may decline -- deletion does not proceed; a new request
-- would be required to try again (brief section 14).
create function public.decline_care_space_deletion(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.care_space_deletion_requests%rowtype;
  caller_is_active_organiser boolean;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into request_row from public.care_space_deletion_requests where id = target_request_id;
  if not found then
    return; -- already resolved -- safe no-op
  end if;

  select exists (
    select 1 from public.care_space_memberships m
    where m.care_space_id = request_row.care_space_id
      and m.user_id = (select auth.uid())
      and m.role = 'organiser'
      and m.membership_status = 'active'
  ) into caller_is_active_organiser;

  if not caller_is_active_organiser then
    raise exception 'Only an active organiser of this care space can decline its removal' using errcode = '42501';
  end if;

  delete from public.care_space_deletion_requests where id = target_request_id;
end;
$$;

revoke all on function public.decline_care_space_deletion(uuid) from public, anon;
grant execute on function public.decline_care_space_deletion(uuid) to authenticated;

-- cancel_care_space_deletion(): only the ORIGINAL requester may cancel
-- their own request before it executes (a distinct, narrower authority
-- than decline's "any organiser" -- brief section 14).
create function public.cancel_care_space_deletion(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.care_space_deletion_requests%rowtype;
  caller_membership_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into request_row from public.care_space_deletion_requests where id = target_request_id;
  if not found then
    return; -- already resolved -- safe no-op
  end if;

  select id into caller_membership_id
  from public.care_space_memberships
  where care_space_id = request_row.care_space_id
    and user_id = (select auth.uid())
    and membership_status = 'active';

  if caller_membership_id is null or caller_membership_id <> request_row.requested_by_membership_id then
    raise exception 'Only the organiser who requested this removal can cancel it' using errcode = '42501';
  end if;

  delete from public.care_space_deletion_requests where id = target_request_id;
end;
$$;

revoke all on function public.cancel_care_space_deletion(uuid) from public, anon;
grant execute on function public.cancel_care_space_deletion(uuid) to authenticated;

-- get_care_space_deletion_status(): the one read the client needs to show
-- "Waiting for 1 organiser" and who has/hasn't approved yet.
create function public.get_care_space_deletion_status(target_care_space_id uuid)
returns table(
  request_id uuid,
  requested_by_membership_id uuid,
  reason text,
  created_at timestamptz,
  organiser_count integer,
  approved_count integer,
  approved_membership_ids uuid[]
)
language sql
stable security definer
set search_path = ''
as $$
  select
    req.id,
    req.requested_by_membership_id,
    req.reason,
    req.created_at,
    (select count(*)::int from public.care_space_memberships m
      where m.care_space_id = req.care_space_id and m.role = 'organiser' and m.membership_status = 'active'),
    (select count(*)::int from public.care_space_deletion_approvals a
      join public.care_space_memberships m on m.id = a.membership_id
      where a.request_id = req.id and m.role = 'organiser' and m.membership_status = 'active'),
    (select coalesce(array_agg(a.membership_id), '{}') from public.care_space_deletion_approvals a
      join public.care_space_memberships m on m.id = a.membership_id
      where a.request_id = req.id and m.role = 'organiser' and m.membership_status = 'active')
  from public.care_space_deletion_requests req
  where req.care_space_id = target_care_space_id
    and exists (
      select 1 from public.care_space_memberships m
      where m.care_space_id = target_care_space_id
        and m.user_id = (select auth.uid())
        and m.role = 'organiser'
        and m.membership_status = 'active'
    );
$$;

revoke all on function public.get_care_space_deletion_status(uuid) from public, anon;
grant execute on function public.get_care_space_deletion_status(uuid) to authenticated;

-- delete_care_space(): the one new gate. A sole active organiser is
-- unaffected (organiser_count <= 1 branch). With multiple active
-- organisers, a direct call is now rejected UNLESS it arrives via the
-- trusted internal consensus path above (the exact same transaction-local
-- flag technique this function's own migration already established for
-- care_space_activity_is_immutable()'s one deliberate exception) -- a raw
-- client call with multiple organisers still active is always rejected,
-- regardless of who calls it.
create or replace function public.delete_care_space(target_care_space_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership public.care_space_memberships%rowtype;
  organiser_count integer;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Idempotency: a retry against a care space already deleted (the client
  -- never saw the first call's response, or the app was closed mid-call)
  -- is a safe, silent no-op -- the terminal state is already reached.
  if not exists (select 1 from public.care_spaces where id = target_care_space_id) then
    return;
  end if;

  select * into caller_membership
  from public.care_space_memberships
  where care_space_id = target_care_space_id
    and user_id = (select auth.uid())
    and membership_status = 'active'
    and role = 'organiser'
  for update;

  if not found then
    raise exception 'Only an active organiser of this care space can remove it' using errcode = '42501';
  end if;

  select count(*) into organiser_count
  from public.care_space_memberships
  where care_space_id = target_care_space_id and role = 'organiser' and membership_status = 'active';

  if organiser_count > 1 and coalesce(current_setting('lilica.deletion_consensus_reached', true), '') <> 'true' then
    raise exception 'Because this care space has more than one organiser, all organisers must agree before it can be permanently removed -- use request_care_space_deletion() instead' using errcode = '42501';
  end if;

  -- Leaf/history tables with no further dependents.
  delete from public.occurrence_versions
  where occurrence_id in (select id from public.occurrences where care_space_id = target_care_space_id);
  delete from public.occurrence_mutation_receipts where care_space_id = target_care_space_id;
  delete from public.record_mutation_receipts where care_space_id = target_care_space_id;

  -- Tables referencing occurrences/records/memberships, none of which are
  -- themselves referenced by anything else deleted below.
  delete from public.assignments where care_space_id = target_care_space_id;

  -- See the care_space_activity_is_immutable() trigger's own comment
  -- (20260914120000_delete_care_space.sql) -- this is the one deliberate,
  -- narrow, transaction-scoped exception to it. Reset immediately after so
  -- nothing else in this same transaction could ever rely on the flag
  -- still being set.
  perform set_config('lilica.deleting_care_space', 'true', true);
  delete from public.care_space_activity where care_space_id = target_care_space_id;
  perform set_config('lilica.deleting_care_space', 'false', true);

  delete from public.record_links where care_space_id = target_care_space_id;
  delete from public.record_attachments where care_space_id = target_care_space_id;

  -- Occurrences reference records AND recurrence_rules AND
  -- recurrence_series -- must be gone before any of those three.
  delete from public.occurrences where care_space_id = target_care_space_id;

  -- recurrence_rules references recurrence_series and records -- must be
  -- gone before both.
  delete from public.recurrence_rules where care_space_id = target_care_space_id;
  delete from public.recurrence_series where care_space_id = target_care_space_id;

  -- Records themselves, once nothing above still references them.
  delete from public.records where care_space_id = target_care_space_id;

  -- Remaining care-space-level tables referencing memberships.
  delete from public.care_space_contacts where care_space_id = target_care_space_id;
  delete from public.care_space_invitations where care_space_id = target_care_space_id;

  -- care_space_domain_grants.membership_id cascades automatically (the
  -- one genuine ON DELETE CASCADE in this whole graph), but its OWN
  -- granted_by_membership_id column is a separate, non-cascading FK --
  -- both directions are always intra-space, so deleting every grant row
  -- via either column, scoped to this care space's own memberships, is
  -- correct and complete.
  delete from public.care_space_domain_grants
  where membership_id in (select id from public.care_space_memberships where care_space_id = target_care_space_id)
     or granted_by_membership_id in (select id from public.care_space_memberships where care_space_id = target_care_space_id);

  -- care_space_deletion_requests.requested_by_membership_id is a second,
  -- separate non-cascading FK to care_space_memberships (its OWN
  -- care_space_id FK cascades, but that only fires once care_spaces
  -- itself is deleted, which happens after memberships below) -- a real
  -- bug found only by running this exact deletion, the same class of
  -- issue already found once before for care_space_domain_grants.
  -- Deleting the request row here also cascades away its own approvals
  -- (ON DELETE CASCADE on request_id).
  delete from public.care_space_deletion_requests where care_space_id = target_care_space_id;

  delete from public.care_space_memberships where care_space_id = target_care_space_id;

  -- supported_people has no dependents of its own.
  delete from public.supported_people where care_space_id = target_care_space_id;

  -- The care space itself, last. care_space_deletion_requests/approvals
  -- (ON DELETE CASCADE) vanish automatically here if any exist.
  delete from public.care_spaces where id = target_care_space_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. list_my_supported_people(): add `status`, so the client can tell
--    ACTIVE from ARCHIVED without a second RPC per space -- exactly the
--    same reasoning that added `role` in the prior migration.
-- ---------------------------------------------------------------------
drop function if exists public.list_my_supported_people();

create function public.list_my_supported_people()
returns table(
  draft_id uuid,
  care_space_id uuid,
  supported_person_id uuid,
  membership_id uuid,
  display_name text,
  relationship_type text,
  relationship_label text,
  role text,
  status text
)
language sql
stable security definer
set search_path = ''
as $$
  select
    membership.bootstrap_id,
    membership.care_space_id,
    person.id,
    membership.id,
    person.display_name,
    membership.relationship_type,
    membership.relationship_label,
    membership.role,
    care_space.status
  from public.care_space_memberships membership
  join public.supported_people person on person.care_space_id = membership.care_space_id
  join public.care_spaces care_space on care_space.id = membership.care_space_id
  where membership.user_id = (select auth.uid())
    and membership.membership_status = 'active'
  order by membership.created_at, membership.id;
$$;

revoke all on function public.list_my_supported_people() from public;
revoke all on function public.list_my_supported_people() from anon;
grant execute on function public.list_my_supported_people() to authenticated;
