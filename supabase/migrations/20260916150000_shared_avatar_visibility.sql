-- Direct product-owner report (14 September 2026): a Care Circle
-- member's real photo (e.g. Gillian's) never showed anywhere except to
-- that person themselves -- profile-avatars' own RLS was deliberately
-- scoped to owner-only read at launch (20260912180000_profile_avatars
-- .sql's own header explicitly named this as a real, separate,
-- not-yet-made product decision). This makes that decision: a
-- shared-care-space member may now read another active member's
-- avatar, scoped exactly to "do we currently share an active care
-- space" -- never a blanket "any authenticated user can read any
-- avatar" policy.

create policy "profile avatar: shared care-space members can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and exists (
    select 1
    from public.care_space_memberships mine
    join public.care_space_memberships theirs
      on theirs.care_space_id = mine.care_space_id
    where mine.user_id = (select auth.uid())
      and mine.membership_status = 'active'
      and theirs.membership_status = 'active'
      and theirs.user_id = (
        case when (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
          then ((storage.foldername(name))[1])::uuid
          else null
        end
      )
  )
);

-- Surface avatar_path on the existing member-list read (additive column
-- only -- redefine rather than duplicate, since the OUT-parameter shape
-- changes).
drop function if exists public.list_care_space_members(uuid);

create function public.list_care_space_members(target_care_space_id uuid)
returns table (
  membership_id uuid,
  display_name text,
  role text,
  relationship_type text,
  relationship_label text,
  is_self boolean,
  granted_domains text[],
  avatar_path text
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
    ),
    profile.avatar_path
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
