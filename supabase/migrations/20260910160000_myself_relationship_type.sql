-- Adds 'Myself' as a valid relationship_type so an organiser can represent
-- their own care/wellbeing using the exact same care-space/membership
-- architecture as any other supported person, per the approved
-- self/someone-else onboarding fork. No new table, no parallel identity
-- system: only the existing constraint's allowed value set changes.

alter table public.care_space_memberships
  drop constraint care_space_memberships_relationship_type;

alter table public.care_space_memberships
  add constraint care_space_memberships_relationship_type check (
    relationship_type in ('Myself', 'Mum', 'Dad', 'Partner', 'Child', 'Grandparent', 'Other relative', 'Someone else')
  );

-- Defence in depth against a duplicate "Myself" care space (e.g. a retried
-- or duplicate-submitted bootstrap call): at most one active 'Myself'
-- membership per user, enforced at the database, not only in client UI.
create unique index care_space_memberships_one_self_per_user
  on public.care_space_memberships (user_id)
  where relationship_type = 'Myself';
