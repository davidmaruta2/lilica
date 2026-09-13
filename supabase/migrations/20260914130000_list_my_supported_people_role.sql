-- Remove-supported-person follow-up: Privacy & data's own "Remove a
-- supported person" section only ever showed the CURRENTLY ACTIVE care
-- space, since that was the only one whose organiser status was already
-- known client-side (via careCircleMembers, only ever fetched for the
-- active space). A real product-owner report ("I have two supported
-- people but it only offers to remove one") identified this as a genuine
-- gap: an organiser of MULTIPLE people should be able to see and remove
-- any of them from this one screen, not just whichever happens to be
-- selected in the switcher.
--
-- list_my_supported_people() (unchanged since Phase 6/7) already lists
-- every care space this account has an active membership in - it was
-- simply missing the one extra column (role) needed to filter that list
-- down to "the ones I organise" without a second RPC per space. Based on
-- the CURRENT live body, verified by direct inspection before writing
-- this migration, not assumed from an earlier version.
-- Adding a column to a `returns table(...)` signature is a genuine
-- return-type change, which Postgres refuses under plain `create or
-- replace` (SQLSTATE 42P13) -- the function must be dropped first.
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
  role text
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
    membership.role
  from public.care_space_memberships membership
  join public.supported_people person on person.care_space_id = membership.care_space_id
  where membership.user_id = (select auth.uid())
    and membership.membership_status = 'active'
  order by membership.created_at, membership.id;
$$;

-- Dropping the function drops its own grants too -- restored exactly as
-- originally set (Phase 6), nothing new.
revoke all on function public.list_my_supported_people() from public;
revoke all on function public.list_my_supported_people() from anon;
grant execute on function public.list_my_supported_people() to authenticated;
