-- Focused assertions for the approved self/someone-else onboarding fork:
-- 'Myself' is a valid relationship_type through the existing bootstrap
-- path, and at most one 'Myself' membership can exist per user.

begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(6);

insert into auth.users (id, email)
values
  ('c0000000-0000-0000-0000-000000000001', 'myself-a@example.test'),
  ('c0000000-0000-0000-0000-000000000002', 'myself-b@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);

select extensions.lives_ok(
  $$ select * from public.bootstrap_supported_people('[
    {"draft_id":"c1000000-0000-4000-a000-000000000001","display_name":"David","relationship_type":"Myself","relationship_label":null}
  ]'::jsonb) $$,
  'User A can provision a Myself care space through the existing bootstrap RPC'
);

select extensions.results_eq(
  $$ select relationship_type from public.care_space_memberships where user_id = 'c0000000-0000-0000-0000-000000000001' $$,
  $$ values ('Myself'::text) $$,
  'the stored relationship_type is Myself, not a freeform label'
);

select extensions.is(
  (select count(*) from public.care_spaces cs join public.care_space_memberships csm on csm.care_space_id = cs.id where csm.user_id = 'c0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'User A has exactly one care space so far'
);

select extensions.throws_ok(
  $$ select * from public.bootstrap_supported_people('[
    {"draft_id":"c1000000-0000-4000-a000-000000000002","display_name":"David again","relationship_type":"Myself","relationship_label":null}
  ]'::jsonb) $$,
  '23505',
  null,
  'a second Myself membership for the same user is rejected by the database, not only client-side UI'
);

select extensions.is(
  (select count(*) from public.care_spaces cs join public.care_space_memberships csm on csm.care_space_id = cs.id where csm.user_id = 'c0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'the rejected duplicate attempt left no partial second care space behind'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', true);
select extensions.lives_ok(
  $$ select * from public.bootstrap_supported_people('[
    {"draft_id":"c2000000-0000-4000-a000-000000000001","display_name":"Priya","relationship_type":"Myself","relationship_label":null}
  ]'::jsonb) $$,
  'the one-Myself-per-user rule is per user, not global -- a different user can also have their own Myself care space'
);

select * from extensions.finish();
rollback;
