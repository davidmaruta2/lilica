begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(32);

select extensions.has_table('public', 'care_spaces', 'care spaces table exists');
select extensions.has_table('public', 'supported_people', 'supported people table exists');
select extensions.has_table('public', 'care_space_memberships', 'memberships table exists');
select extensions.is((select relrowsecurity from pg_class where oid = 'public.care_spaces'::regclass), true, 'care spaces use RLS');
select extensions.is((select relrowsecurity from pg_class where oid = 'public.supported_people'::regclass), true, 'supported people use RLS');
select extensions.is((select relrowsecurity from pg_class where oid = 'public.care_space_memberships'::regclass), true, 'memberships use RLS');

insert into auth.users (id, email)
values
  ('a0000000-0000-0000-0000-000000000001', 'multi-a@example.test'),
  ('b0000000-0000-0000-0000-000000000002', 'multi-b@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);

select extensions.lives_ok(
  $$ select * from public.bootstrap_supported_people('[
    {"draft_id":"a1000000-0000-4000-a000-000000000001","display_name":"Jackie","relationship_type":"Mum","relationship_label":null},
    {"draft_id":"a1000000-0000-4000-a000-000000000002","display_name":"Brian","relationship_type":"Dad","relationship_label":null},
    {"draft_id":"a1000000-0000-4000-a000-000000000003","display_name":"Amelia","relationship_type":"Child","relationship_label":null},
    {"draft_id":"a1000000-0000-4000-a000-000000000004","display_name":"Oscar","relationship_type":"Child","relationship_label":null}
  ]'::jsonb) $$,
  'User A can atomically provision several people'
);

select extensions.is((select count(*) from public.care_spaces), 4::bigint, 'User A can read all four member care spaces');
select extensions.is((select count(*) from public.supported_people), 4::bigint, 'User A can read all four supported people');
select extensions.is((select count(*) from public.care_space_memberships), 4::bigint, 'User A can read all four memberships');
select extensions.is((select count(*) from public.care_space_memberships where relationship_type = 'Child'), 2::bigint, 'duplicate Child relationships remain distinct');
select extensions.is((select count(distinct care_space_id) from public.care_space_memberships), 4::bigint, 'every person has a distinct care space');

select extensions.lives_ok(
  $$ select * from public.bootstrap_supported_people('[
    {"draft_id":"a1000000-0000-4000-a000-000000000001","display_name":"Jackie","relationship_type":"Mum","relationship_label":null},
    {"draft_id":"a1000000-0000-4000-a000-000000000002","display_name":"Brian","relationship_type":"Dad","relationship_label":null}
  ]'::jsonb) $$,
  'retrying the same bootstrap IDs succeeds'
);
select extensions.is((select count(*) from public.care_spaces), 4::bigint, 'retry does not duplicate care spaces');
select extensions.is((select count(*) from public.supported_people), 4::bigint, 'retry does not duplicate supported people');
select extensions.is((select count(*) from public.care_space_memberships), 4::bigint, 'retry does not duplicate memberships');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
select extensions.lives_ok(
  $$ select * from public.bootstrap_supported_people('[
    {"draft_id":"b1000000-0000-4000-a000-000000000001","display_name":"Helen","relationship_type":"Someone else","relationship_label":"Neighbour"}
  ]'::jsonb) $$,
  'User B can provision Helen with a custom relationship'
);
select extensions.is((select count(*) from public.care_spaces), 1::bigint, 'User B can read only Helen care space');
select extensions.results_eq($$ select display_name from public.supported_people $$, $$ values ('Helen'::text) $$, 'User B can read only Helen');
select extensions.is((select count(*) from public.care_space_memberships), 1::bigint, 'User B cannot read User A memberships');

select extensions.throws_ok(
  $$ insert into public.care_space_memberships (care_space_id, user_id, relationship_type, bootstrap_id)
     select id, 'b0000000-0000-0000-0000-000000000002', 'Dad', gen_random_uuid()
     from public.care_spaces limit 1 $$,
  '42501',
  'permission denied for table care_space_memberships',
  'User B cannot manufacture a membership'
);
select extensions.throws_ok(
  $$ update public.care_space_memberships set care_space_id = gen_random_uuid() $$,
  '42501',
  'permission denied for table care_space_memberships',
  'User B cannot transfer a membership'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select extensions.throws_ok($$ select * from public.care_spaces $$, '42501', 'permission denied for table care_spaces', 'anonymous cannot read care spaces');
select extensions.throws_ok($$ select * from public.supported_people $$, '42501', 'permission denied for table supported_people', 'anonymous cannot read supported people');
select extensions.throws_ok($$ select * from public.care_space_memberships $$, '42501', 'permission denied for table care_space_memberships', 'anonymous cannot read memberships');
select extensions.throws_ok(
  $$ select * from public.bootstrap_supported_people('[{"draft_id":"c1000000-0000-4000-a000-000000000001","display_name":"Nope","relationship_type":"Mum","relationship_label":null}]'::jsonb) $$,
  '42501',
  'permission denied for function bootstrap_supported_people',
  'anonymous cannot invoke provisioning'
);

reset role;
set local role postgres;
select extensions.throws_ok(
  $$ with space as (
       insert into public.care_spaces (bootstrap_owner_id, bootstrap_id)
       values ('a0000000-0000-0000-0000-000000000001', gen_random_uuid()) returning id
     )
     insert into public.supported_people (care_space_id, display_name)
     select id, '   ' from space $$,
  '23514',
  null,
  'a care space cannot contain a second supported person'
);
select extensions.throws_ok(
  $$ insert into public.care_space_memberships (care_space_id, user_id, relationship_type, relationship_label, bootstrap_id)
     values (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'Someone else', null, gen_random_uuid()) $$,
  '23503',
  null,
  'memberships require a real care space'
);
select extensions.throws_ok(
  $$ update public.care_space_memberships set user_id = 'b0000000-0000-0000-0000-000000000002' where user_id = 'a0000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'membership identity cannot be transferred'
);
select extensions.is((select count(*) from public.care_spaces), 5::bigint, 'only five intended care spaces exist globally');
select extensions.is((select count(*) from public.supported_people), 5::bigint, 'only five intended supported people exist globally');
select extensions.is((select count(*) from public.care_space_memberships), 5::bigint, 'only five intended memberships exist globally');

select * from extensions.finish();
rollback;
