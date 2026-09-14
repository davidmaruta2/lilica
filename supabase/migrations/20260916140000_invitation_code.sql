-- Care Circle invitation & joining flow completion (`\downloads\carecircle.txt`,
-- 14 September 2026): additive extension only. The existing invitation
-- record (care_space_invitations, unchanged), its secure token (the
-- row's own id, unchanged), and its acceptance authority
-- (accept_invitation(), completely untouched -- not redefined by this
-- migration) remain the ONE authoritative invitation/membership/
-- permission architecture. This migration adds exactly one thing: a
-- short, human-friendly CODE that resolves to an existing invitation's
-- id, for someone to type manually instead of depending entirely on an
-- email/deep link. The code is a LOCATOR, not a second security model
-- -- see resolve_invitation_by_code() below, which returns only a
-- minimal safe preview and leaves every identity/eligibility check to
-- the existing, unmodified accept_invitation().

-- ---------------------------------------------------------------------
-- 1. Code generator -- unambiguous alphabet (no 0/O, 1/I/L), 8 characters,
--    displayed by the client as XXXX-XXXX. Retries on collision; the
--    table is small and the alphabet large (32^8 ≈ 1.1 trillion), so a
--    collision is exceptionally rare, but correctness shouldn't depend
--    on that -- it actually checks.
-- ---------------------------------------------------------------------
create function public.generate_invitation_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- excludes 0/O, 1/I/L
  candidate text;
  attempt int := 0;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, (floor(random() * length(alphabet)) + 1)::int, 1);
    end loop;
    attempt := attempt + 1;
    exit when not exists (
      select 1 from public.care_space_invitations where invite_code = candidate
    );
    if attempt > 20 then
      raise exception 'Could not generate a unique invitation code' using errcode = '55000';
    end if;
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. The column itself. NOT derived from user id, care-space id or
--    email -- generated independently, purely random within the fixed
--    alphabet above. Backfills every existing row with its own distinct
--    code (the function is volatile, so ADD COLUMN ... DEFAULT evaluates
--    it once per existing row, not once globally).
-- ---------------------------------------------------------------------
alter table public.care_space_invitations
  add column invite_code text not null default public.generate_invitation_code();

alter table public.care_space_invitations
  add constraint care_space_invitations_invite_code_unique unique (invite_code);

alter table public.care_space_invitations
  add constraint care_space_invitations_invite_code_shape
  check (invite_code ~ '^[A-Z2-9]{8}$');

-- invite_member()'s own "on conflict (care_space_id, lower(invitee_email))
-- where status = 'pending' do update" path (re-inviting the same email
-- while a pending invitation already exists) deliberately does NOT
-- reassign invite_code -- the column's own DEFAULT only ever fires on
-- INSERT, so a re-invite keeps the SAME code the organiser may already
-- have shared. No change to invite_member() itself is needed for this.

-- ---------------------------------------------------------------------
-- 3. resolve_invitation_by_code(): the ONLY new way to reach an
--    invitation by code. Returns the minimum information needed to
--    show an invitee what they'd be joining -- never invitee_email
--    (identity), never care_space_id, never anything else. Does NOT
--    create membership, does NOT check the caller's own identity against
--    the invitation (that stays exclusively accept_invitation()'s job,
--    completely unmodified) -- this function only ever LOCATES an
--    invitation by its human-friendly code, exactly as opening the
--    email/deep-link would locate the same invitation by its id.
-- ---------------------------------------------------------------------
create function public.resolve_invitation_by_code(code_input text)
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

  -- Lazy expiry, mirroring list_my_invitations()'s own established
  -- pattern -- an invitation whose time has passed is expired at the
  -- point anything next tries to resolve it, not by a background job.
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
    -- The code matched a REAL invitation the caller already had --
    -- confirming it is no longer active leaks nothing new about
    -- identity or about any OTHER care space; it is the "where the
    -- server can safely distinguish it" calmer message the brief itself
    -- asks for, not a security weakening.
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

-- ---------------------------------------------------------------------
-- 4. Surface the code on the organiser's own reads -- additive columns
--    on the two existing read paths an organiser already uses, never a
--    new table/RPC for this half.
-- ---------------------------------------------------------------------
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
    invitation.created_at, invitation.expires_at
  from public.care_space_invitations invitation
  where invitation.care_space_id = target_care_space_id
  order by invitation.created_at desc;
end;
$$;

revoke all on function public.list_care_space_invitations(uuid) from public;
revoke all on function public.list_care_space_invitations(uuid) from anon;
grant execute on function public.list_care_space_invitations(uuid) to authenticated;

-- invite_member()'s own return type is `public.care_space_invitations`
-- (the whole row) -- it already includes invite_code with zero changes
-- needed to that function.
