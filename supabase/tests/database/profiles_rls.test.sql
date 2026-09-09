begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(17);

select extensions.has_table('public', 'profiles', 'profiles table exists');
select extensions.col_is_pk('public', 'profiles', 'id', 'profiles.id is the stable primary key');
select extensions.is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'profiles has row level security enabled'
);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('20000000-0000-0000-0000-000000000002', 'other@example.test'),
  ('30000000-0000-0000-0000-000000000003', 'new-owner@example.test'),
  ('40000000-0000-0000-0000-000000000004', 'unowned@example.test');

insert into public.profiles (id, display_name)
values
  ('10000000-0000-0000-0000-000000000001', 'Owner'),
  ('20000000-0000-0000-0000-000000000002', 'Other user');

set local role anon;
select extensions.throws_ok(
  $$ select * from public.profiles $$,
  '42501',
  'permission denied for table profiles',
  'anonymous users cannot read profiles'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select extensions.results_eq(
  $$ select id from public.profiles order by id $$,
  $$ values ('10000000-0000-0000-0000-000000000001'::uuid) $$,
  'an authenticated owner can read only their profile'
);
select extensions.is(
  (select count(*) from public.profiles where id = '20000000-0000-0000-0000-000000000002'),
  0::bigint,
  'an authenticated owner cannot read another profile'
);
select extensions.is_empty(
  $$
    update public.profiles
    set display_name = 'Forbidden change'
    where id = '20000000-0000-0000-0000-000000000002'
    returning id
  $$,
  'a non-owner cannot update another profile'
);
select extensions.lives_ok(
  $$ update public.profiles set display_name = 'Updated owner' where id = '10000000-0000-0000-0000-000000000001' $$,
  'the owner can update their profile'
);
select extensions.is(
  (select display_name from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'Updated owner',
  'the permitted owner update is stored'
);
select extensions.throws_ok(
  $$ update public.profiles set id = '30000000-0000-0000-0000-000000000003' where id = '10000000-0000-0000-0000-000000000001' $$,
  '42501',
  'new row violates row-level security policy for table "profiles"',
  'an owner cannot alter the profile ownership identifier'
);

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok(
  $$ insert into public.profiles (id, display_name) values ('30000000-0000-0000-0000-000000000003', 'New owner') $$,
  'an authenticated owner can create their own profile'
);
select extensions.throws_ok(
  $$ insert into public.profiles (id, display_name) values ('40000000-0000-0000-0000-000000000004', 'Not mine') $$,
  '42501',
  'new row violates row-level security policy for table "profiles"',
  'an authenticated user cannot create another user profile'
);
select extensions.throws_ok(
  $$ delete from public.profiles where id = '30000000-0000-0000-0000-000000000003' $$,
  '42501',
  'permission denied for table profiles',
  'profile deletion is not permitted in this phase'
);

reset role;
set local role postgres;
select extensions.throws_ok(
  $$ insert into public.profiles (id, display_name) values ('40000000-0000-0000-0000-000000000004', '   ') $$,
  '23514',
  null,
  'blank display names fail the database constraint'
);
select extensions.is(
  (select count(*) from public.profiles),
  3::bigint,
  'denied writes did not create or delete profile rows'
);
select extensions.is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'profiles'),
  3::bigint,
  'profiles exposes only the three explicit owner policies'
);
select extensions.is(
  has_table_privilege('anon', 'public.profiles', 'select'),
  false,
  'the anonymous role has no direct table grant'
);

select * from extensions.finish();
rollback;
