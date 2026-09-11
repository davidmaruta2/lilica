-- Phase 15: Care-Circle Invitations And Collaboration.
--
-- Extends the Phase 6/7 membership/RLS skeleton rather than duplicating it.
-- Core invariant carried through every object below: sharing must be real,
-- explicit, permissioned and revocable. Nothing here infers membership from
-- names, emails, relationships, contacts or legacy responsibility text.
--
-- Adds:
--   * care_space_memberships.role gains 'contributor' and 'viewer' alongside
--     the existing 'organiser'. Role is a convenience preset, not the sole
--     security boundary -- non-organiser access is additionally scoped by
--     explicit per-domain grants (below), matching the domain taxonomy
--     already established in Phase 7 (record_domain_for_type()).
--   * care_space_domain_grants: one row per (membership, domain) a
--     non-organiser has been explicitly given read/write access to.
--     Organisers do not need rows here -- their role alone grants full
--     access, unchanged from Phase 7/8/9's existing behaviour.
--   * care_space_invitations: the full pending/accepted/declined/expired/
--     revoked lifecycle. A pending invitee is never a member, never
--     assignable, never authorised to read anything -- it is purely a
--     row an organiser and the invited address can see, via
--     security-definer functions only (never direct table access for the
--     invitee, since they may have no membership yet to scope RLS against).
--   * membership_has_domain_access(): the role/grant decision shared by
--     can_access_care_space_records() (caller-scoped, unchanged signature)
--     and by apply_record_mutation()'s new assignee-visibility check.
--   * apply_record_mutation() is redefined (same signature) to check write
--     access against the record's ACTUAL domain (previously hardcoded to
--     'general', which would have wrongly blocked/allowed contributors with
--     partial grants) and to reject any mutation that would assign a
--     record to a membership without read access to that record's domain --
--     assignment must never grant permission, and a removed/ungranted
--     assignee must fail safely, including on a replayed offline mutation.
--   * Server functions for the full lifecycle: invite_member,
--     list_my_invitations, accept_invitation, decline_invitation,
--     revoke_invitation, change_member_role, remove_member,
--     leave_care_space, list_care_space_members,
--     list_care_space_invitations. All authenticated, authorised,
--     transactional and care-space-bound. Removal/leave reuse the existing
--     membership_status active/revoked lifecycle -- no new column needed --
--     so can_access_care_space_records() already denies a revoked
--     membership everywhere it is checked.

-- ---------------------------------------------------------------------
-- 1. Role preset now includes Contributor and Viewer.
-- ---------------------------------------------------------------------

alter table public.care_space_memberships
  drop constraint care_space_memberships_role;

alter table public.care_space_memberships
  add constraint care_space_memberships_role check (
    role in ('organiser', 'contributor', 'viewer')
  );

-- Role was immutable under Phase 6's original identity-protection trigger
-- (an organiser-only value at the time, so there was nothing to change).
-- It is now a legitimate, authorised transition -- gated by
-- change_member_role()'s own organiser check and sole-organiser safety
-- check below, not by trigger immutability. care_space_id, user_id and
-- bootstrap_id remain immutable, unchanged from Phase 6.
create or replace function public.protect_membership_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.care_space_id <> old.care_space_id
    or new.user_id <> old.user_id
    or new.bootstrap_id <> old.bootstrap_id then
    raise exception 'Membership ownership identifiers are immutable' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Explicit per-domain grants for non-organiser members.
-- ---------------------------------------------------------------------

create table public.care_space_domain_grants (
  membership_id uuid not null references public.care_space_memberships(id) on delete cascade,
  domain text not null check (domain in ('general', 'health', 'financial', 'home', 'documents')),
  can_read boolean not null default true,
  can_write boolean not null default false,
  granted_at timestamptz not null default now(),
  granted_by_membership_id uuid references public.care_space_memberships(id),
  primary key (membership_id, domain)
);

alter table public.care_space_domain_grants enable row level security;
alter table public.care_space_domain_grants force row level security;

create policy care_space_domain_grants_select on public.care_space_domain_grants
  for select to authenticated
  using (
    exists (
      select 1 from public.care_space_memberships self_membership
      where self_membership.id = care_space_domain_grants.membership_id
        and self_membership.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.care_space_memberships grantee
      join public.care_space_memberships organiser_membership
        on organiser_membership.care_space_id = grantee.care_space_id
      where grantee.id = care_space_domain_grants.membership_id
        and organiser_membership.user_id = (select auth.uid())
        and organiser_membership.role = 'organiser'
        and organiser_membership.membership_status = 'active'
    )
  );

-- No insert/update/delete policy: every write to this table goes through
-- the security-definer functions below, which run authorised and audited.

-- ---------------------------------------------------------------------
-- 3. Shared access decision, keyed by membership id (not caller identity),
--    so it can be reused both for "can the caller do X" and for
--    "does this OTHER membership have visibility" (the assignment check).
-- ---------------------------------------------------------------------

create function public.membership_has_domain_access(
  target_membership_id uuid,
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
    where membership.id = target_membership_id
      and membership.membership_status = 'active'
      and target_domain in ('general', 'health', 'financial', 'home', 'documents')
      and requested_action in ('read', 'write')
      and (
        membership.role = 'organiser'
        or exists (
          select 1
          from public.care_space_domain_grants grant_row
          where grant_row.membership_id = membership.id
            and grant_row.domain = target_domain
            and (
              (requested_action = 'read' and grant_row.can_read)
              or (requested_action = 'write' and grant_row.can_write)
            )
        )
      )
  );
$$;

revoke all on function public.membership_has_domain_access(uuid, text, text) from public;
revoke all on function public.membership_has_domain_access(uuid, text, text) from anon;
grant execute on function public.membership_has_domain_access(uuid, text, text) to authenticated;

-- Central Phase 7 record policy boundary, now extended: organiser keeps
-- unconditional access (unchanged), and a contributor/viewer's access is
-- exactly what membership_has_domain_access() says an active membership of
-- theirs has been granted. Record ownership itself is unchanged.
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
  );
$$;

-- ---------------------------------------------------------------------
-- 4. Invitation lifecycle.
-- ---------------------------------------------------------------------

create table public.care_space_invitations (
  id uuid primary key default gen_random_uuid(),
  care_space_id uuid not null references public.care_spaces(id) on delete cascade,
  invited_by_membership_id uuid not null references public.care_space_memberships(id),
  invitee_email text not null,
  role text not null check (role in ('contributor', 'viewer')),
  relationship_type text not null default 'Someone else' check (
    relationship_type in ('Mum', 'Dad', 'Partner', 'Child', 'Grandparent', 'Other relative', 'Someone else')
  ),
  relationship_label text,
  constraint care_space_invitations_relationship_label check (
    case
      when relationship_type in ('Other relative', 'Someone else')
        then char_length(btrim(relationship_label)) between 1 and 50
      else relationship_label is null
    end
  ),
  granted_domains text[] not null default '{}',
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'declined', 'expired', 'revoked')
  ),
  operation_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default (statement_timestamp() + interval '14 days'),
  responded_at timestamptz,
  accepted_membership_id uuid references public.care_space_memberships(id),
  constraint care_space_invitations_operation_id_unique unique (operation_id)
);

create unique index care_space_invitations_one_pending_per_email
  on public.care_space_invitations (care_space_id, lower(invitee_email))
  where status = 'pending';

alter table public.care_space_invitations enable row level security;
alter table public.care_space_invitations force row level security;

-- Only an active organiser of the space can list its invitations directly.
-- The invitee (who may not be a member at all) sees their own pending
-- invitations exclusively through list_my_invitations() below, which is
-- scoped to their authenticated email and never exposes other invitations.
create policy care_space_invitations_select_organiser on public.care_space_invitations
  for select to authenticated
  using (
    exists (
      select 1 from public.care_space_memberships organiser_membership
      where organiser_membership.care_space_id = care_space_invitations.care_space_id
        and organiser_membership.user_id = (select auth.uid())
        and organiser_membership.role = 'organiser'
        and organiser_membership.membership_status = 'active'
    )
  );

-- ---------------------------------------------------------------------
-- 5. invite_member: organiser-only, idempotent via operation_id, explicit
--    role + explicit per-domain grant selection (review-access-before-send).
-- ---------------------------------------------------------------------

create function public.invite_member(
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

revoke all on function public.invite_member(uuid, text, text, text[], text, text, uuid) from public;
revoke all on function public.invite_member(uuid, text, text, text[], text, text, uuid) from anon;
grant execute on function public.invite_member(uuid, text, text, text[], text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. list_my_invitations: the invitee's own pending, unexpired invitations.
--    Also lazily expires anything whose expires_at has passed, so an
--    expired invitation is never silently still acceptable.
-- ---------------------------------------------------------------------

create function public.list_my_invitations()
returns table (
  id uuid,
  care_space_id uuid,
  care_space_name text,
  invited_by_display_name text,
  role text,
  relationship_type text,
  relationship_label text,
  granted_domains text[],
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_email text;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select lower(auth_user.email) into caller_email
  from auth.users auth_user
  where auth_user.id = (select auth.uid());
  if caller_email is null then
    return;
  end if;

  update public.care_space_invitations invitation
  set status = 'expired'
  where lower(invitation.invitee_email) = caller_email
    and invitation.status = 'pending'
    and invitation.expires_at <= now();

  return query
  select
    invitation.id,
    invitation.care_space_id,
    coalesce(person.display_name, 'A Lilica care space'),
    coalesce(inviter_profile.display_name, 'The organiser'),
    invitation.role,
    invitation.relationship_type,
    invitation.relationship_label,
    invitation.granted_domains,
    invitation.created_at,
    invitation.expires_at
  from public.care_space_invitations invitation
  left join public.supported_people person on person.care_space_id = invitation.care_space_id
  left join public.care_space_memberships inviter_membership
    on inviter_membership.id = invitation.invited_by_membership_id
  left join public.profiles inviter_profile on inviter_profile.id = inviter_membership.user_id
  where lower(invitation.invitee_email) = caller_email
    and invitation.status = 'pending'
  order by invitation.created_at desc;
end;
$$;

revoke all on function public.list_my_invitations() from public;
revoke all on function public.list_my_invitations() from anon;
grant execute on function public.list_my_invitations() to authenticated;

-- ---------------------------------------------------------------------
-- 7. accept_invitation: creates the real membership + its domain grants.
--    Idempotent via operation_id on the resulting membership's bootstrap.
-- ---------------------------------------------------------------------

create function public.accept_invitation(
  target_invitation_id uuid,
  operation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_email text;
  invitation public.care_space_invitations%rowtype;
  new_membership_id uuid;
  domain_value text;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select lower(email) into caller_email from auth.users where id = (select auth.uid());

  select * into invitation
  from public.care_space_invitations
  where id = target_invitation_id
  for update;

  if not found or caller_email is null or lower(invitation.invitee_email) <> caller_email then
    raise exception 'Invitation not found' using errcode = '42501';
  end if;

  if invitation.status <> 'pending' or invitation.expires_at <= now() then
    if invitation.status = 'pending' then
      update public.care_space_invitations set status = 'expired' where id = invitation.id;
    end if;
    raise exception 'This invitation is no longer open' using errcode = '22023';
  end if;

  -- A user can hold only one membership row per care space
  -- (care_space_memberships_user_space_unique). If they were a member
  -- before -- including previously removed -- reactivate that same row
  -- rather than inserting a second one; otherwise create a fresh
  -- membership. Either way the resulting access is exactly what this
  -- invitation now grants, never anything left over from before.
  select id into new_membership_id
  from public.care_space_memberships
  where care_space_id = invitation.care_space_id
    and user_id = (select auth.uid());

  if new_membership_id is not null then
    update public.care_space_memberships
    set role = invitation.role,
        relationship_type = invitation.relationship_type,
        relationship_label = invitation.relationship_label,
        membership_status = 'active'
    where id = new_membership_id;
    delete from public.care_space_domain_grants where membership_id = new_membership_id;
  else
    insert into public.care_space_memberships (
      id, care_space_id, user_id, role, relationship_type, relationship_label, bootstrap_id
    ) values (
      operation_id, invitation.care_space_id, (select auth.uid()), invitation.role,
      invitation.relationship_type, invitation.relationship_label, operation_id
    )
    returning id into new_membership_id;
  end if;

  foreach domain_value in array invitation.granted_domains loop
    insert into public.care_space_domain_grants (
      membership_id, domain, can_read, can_write, granted_by_membership_id
    ) values (
      new_membership_id, domain_value, true, invitation.role = 'contributor',
      invitation.invited_by_membership_id
    )
    on conflict (membership_id, domain) do nothing;
  end loop;

  update public.care_space_invitations
  set status = 'accepted', responded_at = now(), accepted_membership_id = new_membership_id
  where id = invitation.id;

  return new_membership_id;
end;
$$;

revoke all on function public.accept_invitation(uuid, uuid) from public;
revoke all on function public.accept_invitation(uuid, uuid) from anon;
grant execute on function public.accept_invitation(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 8. decline_invitation / revoke_invitation: the other two terminal states
--    an invitation can reach on purpose (expiry is automatic, above).
-- ---------------------------------------------------------------------

create function public.decline_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_email text;
  invitation public.care_space_invitations%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select lower(email) into caller_email from auth.users where id = (select auth.uid());

  select * into invitation
  from public.care_space_invitations
  where id = target_invitation_id
  for update;

  if not found or caller_email is null or lower(invitation.invitee_email) <> caller_email then
    raise exception 'Invitation not found' using errcode = '42501';
  end if;

  if invitation.status <> 'pending' then
    raise exception 'This invitation is no longer open' using errcode = '22023';
  end if;

  update public.care_space_invitations
  set status = 'declined', responded_at = now()
  where id = invitation.id;
end;
$$;

revoke all on function public.decline_invitation(uuid) from public;
revoke all on function public.decline_invitation(uuid) from anon;
grant execute on function public.decline_invitation(uuid) to authenticated;

create function public.revoke_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.care_space_invitations%rowtype;
  caller_is_organiser boolean;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into invitation
  from public.care_space_invitations
  where id = target_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.care_space_memberships organiser_membership
    where organiser_membership.care_space_id = invitation.care_space_id
      and organiser_membership.user_id = (select auth.uid())
      and organiser_membership.role = 'organiser'
      and organiser_membership.membership_status = 'active'
  ) into caller_is_organiser;

  if not caller_is_organiser then
    raise exception 'Only an active organiser can revoke an invitation' using errcode = '42501';
  end if;

  if invitation.status <> 'pending' then
    raise exception 'This invitation is no longer open' using errcode = '22023';
  end if;

  update public.care_space_invitations
  set status = 'revoked', responded_at = now()
  where id = invitation.id;
end;
$$;

revoke all on function public.revoke_invitation(uuid) from public;
revoke all on function public.revoke_invitation(uuid) from anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 9. change_member_role / remove_member / leave_care_space: membership
--    lifecycle. Removal and leaving both reuse the existing
--    membership_status active/revoked column -- no new column, and every
--    RLS check already keyed on membership_status denies a revoked
--    membership immediately and everywhere. Sole-organiser safety is
--    enforced in both remove_member and leave_care_space.
-- ---------------------------------------------------------------------

create function public.change_member_role(
  target_membership_id uuid,
  new_role text,
  new_granted_domains text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_membership public.care_space_memberships%rowtype;
  caller_is_organiser boolean;
  organiser_count integer;
  domain_value text;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target_membership
  from public.care_space_memberships
  where id = target_membership_id and membership_status = 'active'
  for update;

  if not found then
    raise exception 'Membership not found' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.care_space_memberships organiser_membership
    where organiser_membership.care_space_id = target_membership.care_space_id
      and organiser_membership.user_id = (select auth.uid())
      and organiser_membership.role = 'organiser'
      and organiser_membership.membership_status = 'active'
  ) into caller_is_organiser;

  if not caller_is_organiser then
    raise exception 'Only an active organiser can change a member''s role' using errcode = '42501';
  end if;

  if new_role not in ('organiser', 'contributor', 'viewer') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;

  if target_membership.role = 'organiser' and new_role <> 'organiser' then
    select count(*) into organiser_count
    from public.care_space_memberships
    where care_space_id = target_membership.care_space_id
      and role = 'organiser'
      and membership_status = 'active';

    if organiser_count <= 1 then
      raise exception 'A care space must always keep at least one organiser' using errcode = '22023';
    end if;
  end if;

  update public.care_space_memberships
  set role = new_role
  where id = target_membership_id;

  delete from public.care_space_domain_grants where membership_id = target_membership_id;

  if new_role <> 'organiser' then
    if new_granted_domains is null then
      new_granted_domains := '{}';
    end if;
    foreach domain_value in array new_granted_domains loop
      if domain_value not in ('general', 'health', 'financial', 'home', 'documents') then
        raise exception 'Invalid domain in grant list' using errcode = '22023';
      end if;
      insert into public.care_space_domain_grants (
        membership_id, domain, can_read, can_write, granted_by_membership_id
      ) values (
        target_membership_id, domain_value, true, new_role = 'contributor',
        (select id from public.care_space_memberships
         where care_space_id = target_membership.care_space_id
           and user_id = (select auth.uid())
           and role = 'organiser'
           and membership_status = 'active'
         limit 1)
      );
    end loop;
  end if;
end;
$$;

revoke all on function public.change_member_role(uuid, text, text[]) from public;
revoke all on function public.change_member_role(uuid, text, text[]) from anon;
grant execute on function public.change_member_role(uuid, text, text[]) to authenticated;

create function public.remove_member(target_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_membership public.care_space_memberships%rowtype;
  caller_is_organiser boolean;
  organiser_count integer;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target_membership
  from public.care_space_memberships
  where id = target_membership_id and membership_status = 'active'
  for update;

  if not found then
    raise exception 'Membership not found' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.care_space_memberships organiser_membership
    where organiser_membership.care_space_id = target_membership.care_space_id
      and organiser_membership.user_id = (select auth.uid())
      and organiser_membership.role = 'organiser'
      and organiser_membership.membership_status = 'active'
  ) into caller_is_organiser;

  if not caller_is_organiser then
    raise exception 'Only an active organiser can remove a member' using errcode = '42501';
  end if;

  if target_membership.role = 'organiser' then
    select count(*) into organiser_count
    from public.care_space_memberships
    where care_space_id = target_membership.care_space_id
      and role = 'organiser'
      and membership_status = 'active';

    if organiser_count <= 1 then
      raise exception 'A care space must always keep at least one organiser' using errcode = '22023';
    end if;
  end if;

  update public.care_space_memberships
  set membership_status = 'revoked'
  where id = target_membership_id;
end;
$$;

revoke all on function public.remove_member(uuid) from public;
revoke all on function public.remove_member(uuid) from anon;
grant execute on function public.remove_member(uuid) to authenticated;

create function public.leave_care_space(target_care_space_id uuid)
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

  select * into caller_membership
  from public.care_space_memberships
  where care_space_id = target_care_space_id
    and user_id = (select auth.uid())
    and membership_status = 'active'
  for update;

  if not found then
    raise exception 'Membership not found' using errcode = '42501';
  end if;

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

  update public.care_space_memberships
  set membership_status = 'revoked'
  where id = caller_membership.id;
end;
$$;

revoke all on function public.leave_care_space(uuid) from public;
revoke all on function public.leave_care_space(uuid) from anon;
grant execute on function public.leave_care_space(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 10. Member/invitation listings for the Care Circle screen. Display is
--     human-friendly (name + relationship/role); identity stays the
--     membership id. Only visible to an active member of the same space.
-- ---------------------------------------------------------------------

create function public.list_care_space_members(target_care_space_id uuid)
returns table (
  membership_id uuid,
  display_name text,
  role text,
  relationship_type text,
  relationship_label text,
  is_self boolean,
  granted_domains text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    membership.id,
    coalesce(profile.display_name, 'A care circle member'),
    membership.role,
    membership.relationship_type,
    membership.relationship_label,
    membership.user_id = (select auth.uid()),
    coalesce(
      array(
        select grant_row.domain
        from public.care_space_domain_grants grant_row
        where grant_row.membership_id = membership.id
        order by grant_row.domain
      ),
      '{}'
    )
  from public.care_space_memberships membership
  left join public.profiles profile on profile.id = membership.user_id
  where membership.care_space_id = target_care_space_id
    and membership.membership_status = 'active'
    and exists (
      select 1 from public.care_space_memberships caller_membership
      where caller_membership.care_space_id = target_care_space_id
        and caller_membership.user_id = (select auth.uid())
        and caller_membership.membership_status = 'active'
    )
  order by (membership.role = 'organiser') desc, membership.created_at;
$$;

revoke all on function public.list_care_space_members(uuid) from public;
revoke all on function public.list_care_space_members(uuid) from anon;
grant execute on function public.list_care_space_members(uuid) to authenticated;

create function public.list_care_space_invitations(target_care_space_id uuid)
returns table (
  id uuid,
  invitee_email text,
  role text,
  relationship_type text,
  relationship_label text,
  granted_domains text[],
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    invitation.id,
    invitation.invitee_email,
    invitation.role,
    invitation.relationship_type,
    invitation.relationship_label,
    invitation.granted_domains,
    invitation.status,
    invitation.created_at,
    invitation.expires_at
  from public.care_space_invitations invitation
  where invitation.care_space_id = target_care_space_id
    and exists (
      select 1 from public.care_space_memberships organiser_membership
      where organiser_membership.care_space_id = target_care_space_id
        and organiser_membership.user_id = (select auth.uid())
        and organiser_membership.role = 'organiser'
        and organiser_membership.membership_status = 'active'
    )
  order by invitation.created_at desc;
$$;

revoke all on function public.list_care_space_invitations(uuid) from public;
revoke all on function public.list_care_space_invitations(uuid) from anon;
grant execute on function public.list_care_space_invitations(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 11. apply_record_mutation, redefined with the same signature: now checks
--     write access against the record's ACTUAL domain (was hardcoded to
--     'general'), and rejects any assignedMembershipId that does not
--     belong to an active membership of this space with read access to
--     that domain -- assignment must never grant permission, and a
--     replayed offline mutation can never recreate access to a removed
--     member. Every other line of the original Phase 7 logic is
--     unchanged.
-- ---------------------------------------------------------------------

create or replace function public.apply_record_mutation(
  operation_id uuid,
  target_record_id uuid,
  target_care_space_id uuid,
  mutation_kind text,
  base_version integer,
  mutation_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  existing_receipt public.record_mutation_receipts%rowtype;
  current_record public.records%rowtype;
  result_record public.records%rowtype;
  payload_type text;
  payload_local_id text;
  payload_data jsonb;
  payload_responsibility text;
  payload_attachments jsonb;
  base_data jsonb;
  base_responsibility text;
  base_attachments jsonb;
  merged_data jsonb;
  merged_responsibility text;
  merged_attachments jsonb;
  changed_key text;
  derived_source text;
  derived_responsibility_source text;
  mutation_domain text;
  assignee_id text;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  if mutation_kind not in ('create', 'import', 'update', 'delete') then
    raise exception 'Unsupported record mutation' using errcode = '22023';
  end if;

  select * into existing_receipt
  from public.record_mutation_receipts receipt
  where receipt.operation_id = apply_record_mutation.operation_id;

  if found then
    if existing_receipt.care_space_id <> target_care_space_id
      or existing_receipt.record_id <> target_record_id
      or existing_receipt.actor_membership_id <> caller_membership_id
      or existing_receipt.mutation_kind <> mutation_kind then
      raise exception 'Operation identity cannot be reused' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'status', 'duplicate',
      'version', existing_receipt.result_version,
      'change_sequence', existing_receipt.result_change_sequence
    );
  end if;

  if mutation_kind in ('create', 'import', 'update') then
    if mutation_payload is null or jsonb_typeof(mutation_payload) <> 'object' then
      raise exception 'Record payload must be an object' using errcode = '22023';
    end if;
    payload_type := mutation_payload->>'record_type';
    payload_local_id := mutation_payload->>'local_record_id';
    payload_data := mutation_payload->'record_data';
    payload_responsibility := nullif(mutation_payload->>'legacy_responsibility_text', '');
    payload_attachments := coalesce(mutation_payload->'attachment_manifest', '[]'::jsonb);
    base_data := mutation_payload->'base_record_data';
    base_responsibility := nullif(mutation_payload->>'base_legacy_responsibility_text', '');
    base_attachments := mutation_payload->'base_attachment_manifest';

    if payload_type not in ('appointment', 'task', 'bill', 'homeMatter', 'document', 'contact', 'careNote', 'update')
      or char_length(coalesce(payload_local_id, '')) < 1
      or jsonb_typeof(payload_data) <> 'object'
      or jsonb_typeof(payload_attachments) <> 'array' then
      raise exception 'Invalid record payload' using errcode = '22023';
    end if;

    mutation_domain := public.record_domain_for_type(payload_type);
    if not public.can_access_care_space_records(target_care_space_id, mutation_domain, 'write') then
      raise exception 'Insufficient permission for this record domain' using errcode = '42501';
    end if;
  end if;

  if mutation_kind in ('create', 'import') then
    if base_version <> 0 then
      return jsonb_build_object('status', 'conflict', 'reason', 'invalid_create_base');
    end if;

    select * into current_record from public.records where id = target_record_id for update;
    if found then
      return jsonb_build_object('status', 'conflict', 'reason', 'record_already_exists', 'version', current_record.version);
    end if;

    derived_source := case mutation_kind when 'import' then 'phase1_import' else 'native' end;
    derived_responsibility_source := case
      when payload_responsibility is null then null
      when mutation_kind = 'import' then 'legacy_local_record'
      else 'native_free_text'
    end;

    assignee_id := payload_data->>'assignedMembershipId';
    if assignee_id is not null then
      if not exists (
        select 1 from public.care_space_memberships assignee
        where assignee.id = assignee_id::uuid
          and assignee.care_space_id = target_care_space_id
          and assignee.membership_status = 'active'
      ) or not public.membership_has_domain_access(assignee_id::uuid, mutation_domain, 'read') then
        raise exception 'Assignee does not have access to this record' using errcode = '42501';
      end if;
    end if;

    insert into public.records (
      id, care_space_id, local_record_id, record_type, record_data,
      legacy_responsibility_text, responsibility_source, attachment_manifest,
      source, created_by_membership_id, updated_by_membership_id
    ) values (
      target_record_id, target_care_space_id, payload_local_id, payload_type, payload_data,
      payload_responsibility, derived_responsibility_source, payload_attachments,
      derived_source, caller_membership_id, caller_membership_id
    ) returning * into result_record;
  else
    select * into current_record
    from public.records
    where id = target_record_id and care_space_id = target_care_space_id
    for update;

    if not found then
      return jsonb_build_object('status', 'conflict', 'reason', 'record_missing');
    end if;

    if mutation_kind = 'delete' then
      mutation_domain := public.record_domain_for_type(current_record.record_type);
      if not public.can_access_care_space_records(target_care_space_id, mutation_domain, 'write') then
        raise exception 'Insufficient permission for this record domain' using errcode = '42501';
      end if;
    end if;

    if current_record.deleted_at is not null then
      return jsonb_build_object('status', 'conflict', 'reason', 'record_deleted', 'version', current_record.version);
    end if;

    if mutation_kind = 'update' then
      if payload_type <> current_record.record_type or payload_local_id <> current_record.local_record_id then
        raise exception 'Record identity cannot be changed' using errcode = '42501';
      end if;
      merged_data := payload_data;
      merged_responsibility := payload_responsibility;
      merged_attachments := payload_attachments;

      if current_record.version <> base_version then
        if jsonb_typeof(base_data) <> 'object' or jsonb_typeof(base_attachments) <> 'array' then
          return jsonb_build_object('status', 'conflict', 'reason', 'stale_version', 'version', current_record.version);
        end if;
        merged_data := current_record.record_data;
        for changed_key in select key from jsonb_object_keys(payload_data || base_data) as key
        loop
          if payload_data->changed_key is distinct from base_data->changed_key
            or (payload_data ? changed_key) <> (base_data ? changed_key) then
            if current_record.record_data->changed_key is distinct from base_data->changed_key
              or (current_record.record_data ? changed_key) <> (base_data ? changed_key) then
              return jsonb_build_object('status', 'conflict', 'reason', 'same_field', 'field', changed_key, 'version', current_record.version);
            end if;
            if payload_data ? changed_key then
              merged_data := jsonb_set(merged_data, array[changed_key], payload_data->changed_key, true);
            else
              merged_data := merged_data - changed_key;
            end if;
          end if;
        end loop;
        if payload_responsibility is distinct from base_responsibility then
          if current_record.legacy_responsibility_text is distinct from base_responsibility then
            return jsonb_build_object('status', 'conflict', 'reason', 'same_field', 'field', 'legacy_responsibility_text', 'version', current_record.version);
          end if;
        else
          merged_responsibility := current_record.legacy_responsibility_text;
        end if;
        if payload_attachments is distinct from base_attachments then
          if current_record.attachment_manifest is distinct from base_attachments then
            return jsonb_build_object('status', 'conflict', 'reason', 'same_field', 'field', 'attachment_manifest', 'version', current_record.version);
          end if;
        else
          merged_attachments := current_record.attachment_manifest;
        end if;
      end if;

      assignee_id := merged_data->>'assignedMembershipId';
      if assignee_id is not null then
        if not exists (
          select 1 from public.care_space_memberships assignee
          where assignee.id = assignee_id::uuid
            and assignee.care_space_id = target_care_space_id
            and assignee.membership_status = 'active'
        ) or not public.membership_has_domain_access(assignee_id::uuid, mutation_domain, 'read') then
          raise exception 'Assignee does not have access to this record' using errcode = '42501';
        end if;
      end if;

      derived_responsibility_source := case
        when merged_responsibility is null then null
        when current_record.responsibility_source = 'legacy_local_record'
          and merged_responsibility is not distinct from current_record.legacy_responsibility_text
          then 'legacy_local_record'
        else 'native_free_text'
      end;
      update public.records
      set record_data = merged_data,
          legacy_responsibility_text = merged_responsibility,
          responsibility_source = derived_responsibility_source,
          attachment_manifest = merged_attachments,
          updated_by_membership_id = caller_membership_id
      where id = target_record_id
      returning * into result_record;
    else
      if current_record.version <> base_version then
        return jsonb_build_object('status', 'conflict', 'reason', 'stale_version', 'version', current_record.version);
      end if;
      update public.records
      set deleted_at = statement_timestamp(),
          updated_by_membership_id = caller_membership_id
      where id = target_record_id
      returning * into result_record;
    end if;
  end if;

  insert into public.record_mutation_receipts (
    operation_id, care_space_id, record_id, actor_membership_id, mutation_kind,
    result_version, result_change_sequence
  ) values (
    operation_id, target_care_space_id, target_record_id, caller_membership_id, mutation_kind,
    result_record.version, result_record.change_sequence
  );

  return jsonb_build_object(
    'status', 'applied',
    'version', result_record.version,
    'change_sequence', result_record.change_sequence
  );
end;
$$;
