-- Direct product-owner report (14 September 2026): a Care Circle
-- member's real photo never showed to fellow members -- only to
-- themselves. Proves the new, narrowly-scoped policy: a fellow ACTIVE
-- member of the SAME care space can read another member's avatar
-- object; an unrelated account (no shared care space) still cannot --
-- this is never a blanket "any authenticated user can read any
-- avatar" policy (row-level only -- no real file service running
-- under pgTAP, same limitation/approach as Phase 16's own
-- document-attachments RLS coverage and profile_avatars.test.sql).
begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(6);

insert into auth.users (id, email)
values
  ('62000000-0000-0000-0000-000000000001', 'sav-david@example.test'),
  ('62000000-0000-0000-0000-000000000002', 'sav-gillian@example.test'),
  ('62000000-0000-0000-0000-000000000003', 'sav-unrelated@example.test');

insert into public.profiles (id, display_name) values
  ('62000000-0000-0000-0000-000000000002', 'Gillian')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
select set_config('request.jwt.claim.sub', '62000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"62100000-0000-4000-a000-000000000001","display_name":"Maggie","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
select sp.care_space_id as maggie_id
from public.supported_people sp
join public.care_spaces cs on cs.id = sp.care_space_id
where cs.bootstrap_owner_id = '62000000-0000-0000-0000-000000000001' and sp.display_name = 'Maggie' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '62000000-0000-0000-0000-000000000001', true);
select public.invite_member(:'maggie_id'::uuid, 'sav-gillian@example.test', 'contributor', array['general'], 'Other relative', 'Cousin', '62200000-0000-4000-a000-000000000001');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '62000000-0000-0000-0000-000000000002', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), '62300000-0000-4000-a000-000000000001');

-- Gillian uploads her own avatar -- mirrors uploadProfilePhoto()'s own
-- two real steps: the storage object, AND profiles.avatar_path itself
-- (list_care_space_members() reads the latter, not the former).
select extensions.lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('profile-avatars', '62000000-0000-0000-0000-000000000002/avatar.jpg', auth.uid()) $$,
  'Gillian can upload her own avatar object'
);
update public.profiles set avatar_path = '62000000-0000-0000-0000-000000000002/avatar.jpg'
where id = '62000000-0000-0000-0000-000000000002';

-- David (a fellow ACTIVE member of the SAME care space) can now read it.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '62000000-0000-0000-0000-000000000001', true);
select extensions.is(
  (select count(*) from storage.objects where bucket_id = 'profile-avatars' and name = '62000000-0000-0000-0000-000000000002/avatar.jpg'),
  1::bigint,
  'a fellow active member of the SAME care space CAN read Gillian''s avatar object'
);

-- list_care_space_members() now surfaces her avatar_path to that same fellow member.
select extensions.results_eq(
  $$select avatar_path from public.list_care_space_members('$$ || :'maggie_id' || $$'::uuid) where display_name = 'Gillian'$$,
  $$values ('62000000-0000-0000-0000-000000000002/avatar.jpg'::text)$$,
  'list_care_space_members() surfaces Gillian''s real avatar_path to a fellow member'
);

-- An unrelated account (no shared care space at all) still cannot.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '62000000-0000-0000-0000-000000000003', true);
select extensions.is(
  (select count(*) from storage.objects where bucket_id = 'profile-avatars' and name = '62000000-0000-0000-0000-000000000002/avatar.jpg'),
  0::bigint,
  'an UNRELATED account with no shared care space still cannot read Gillian''s avatar object -- never a blanket policy'
);

-- Once removed from the care space, David loses that access too --
-- reuses the existing active-membership check, no separate revocation
-- logic needed.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '62000000-0000-0000-0000-000000000001', true);
select public.remove_member((select membership_id from public.list_care_space_members(:'maggie_id'::uuid) where display_name = 'Gillian'));

select extensions.is(
  (select count(*) from storage.objects where bucket_id = 'profile-avatars' and name = '62000000-0000-0000-0000-000000000002/avatar.jpg'),
  0::bigint,
  'once removed, that member''s avatar is no longer readable -- access tracks active membership, not a one-time grant'
);

select extensions.lives_ok(
  $$select 1$$,
  'sanity: transaction still healthy after the removal step'
);

select * from extensions.finish();
rollback;
