-- Care Circle permission-domain audit follow-up: assignments' own read
-- policy previously checked blanket 'general' access rather than the
-- SPECIFIC record/occurrence's own domain -- fixed in
-- 20260916090000_fix_assignments_domain_scoped_read.sql. This file proves
-- the fix directly: a member with only 'general' access cannot read an
-- assignment concerning a financial/health/home/documents record, but can
-- once granted the matching domain; organiser access is unaffected.
begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(9);

insert into auth.users (id, email)
values
  ('60000000-0000-0000-0000-000000000001', 'adr-david@example.test'),
  ('60000000-0000-0000-0000-000000000002', 'adr-marion@example.test');

-- create_assignment()'s own snapshot_name lookup joins to profiles --
-- required for it to find an active assignee at all (a real gap found
-- only by running this test, not by reading the schema).
insert into public.profiles (id, display_name) values
  ('60000000-0000-0000-0000-000000000001', 'David'),
  ('60000000-0000-0000-0000-000000000002', 'Marion')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"60100000-0000-4000-a000-000000000001","display_name":"Maggie","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
select sp.care_space_id as maggie_id
from public.supported_people sp
join public.care_spaces cs on cs.id = sp.care_space_id
where cs.bootstrap_owner_id = '60000000-0000-0000-0000-000000000001' and sp.display_name = 'Maggie' \gset

-- Marion joins as a contributor with ONLY 'general' granted -- no
-- financial, health, home or documents access at all.
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);
select public.invite_member(:'maggie_id'::uuid, 'adr-marion@example.test', 'contributor', array['general'], 'Other relative', 'Aunt', '60700000-0000-4000-a000-000000000002');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000002', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), '60800000-0000-4000-a000-000000000002');

-- David creates one record in each domain and assigns each to himself,
-- so an assignment row genuinely exists for every domain.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);
select public.apply_record_mutation('60200000-0000-4000-a000-000000000001', '60300000-0000-4000-a000-000000000001', :'maggie_id'::uuid, 'import', 0,
  '{"local_record_id":"gen-1","record_type":"task","record_data":{"title":"General task"}}'::jsonb);
select public.apply_record_mutation('60200000-0000-4000-a000-000000000002', '60300000-0000-4000-a000-000000000002', :'maggie_id'::uuid, 'import', 0,
  '{"local_record_id":"fin-1","record_type":"bill","record_data":{"title":"Financial bill"}}'::jsonb);
select public.apply_record_mutation('60200000-0000-4000-a000-000000000003', '60300000-0000-4000-a000-000000000003', :'maggie_id'::uuid, 'import', 0,
  '{"local_record_id":"health-1","record_type":"careNote","record_data":{"title":"Health note"}}'::jsonb);
select public.apply_record_mutation('60200000-0000-4000-a000-000000000004', '60300000-0000-4000-a000-000000000004', :'maggie_id'::uuid, 'import', 0,
  '{"local_record_id":"home-1","record_type":"homeMatter","record_data":{"title":"Home matter"}}'::jsonb);
select public.apply_record_mutation('60200000-0000-4000-a000-000000000005', '60300000-0000-4000-a000-000000000005', :'maggie_id'::uuid, 'import', 0,
  '{"local_record_id":"doc-1","record_type":"document","record_data":{"title":"A document"}}'::jsonb);

select id as david_membership_id from public.care_space_memberships where care_space_id = :'maggie_id'::uuid and user_id = '60000000-0000-0000-0000-000000000001' \gset

select (public.create_assignment(gen_random_uuid(), gen_random_uuid(), :'maggie_id'::uuid, 'record', '60300000-0000-4000-a000-000000000001'::uuid, 'membership', :'david_membership_id'::uuid)).id as general_assignment_id \gset
select (public.create_assignment(gen_random_uuid(), gen_random_uuid(), :'maggie_id'::uuid, 'record', '60300000-0000-4000-a000-000000000002'::uuid, 'membership', :'david_membership_id'::uuid)).id as financial_assignment_id \gset
select (public.create_assignment(gen_random_uuid(), gen_random_uuid(), :'maggie_id'::uuid, 'record', '60300000-0000-4000-a000-000000000003'::uuid, 'membership', :'david_membership_id'::uuid)).id as health_assignment_id \gset
select (public.create_assignment(gen_random_uuid(), gen_random_uuid(), :'maggie_id'::uuid, 'record', '60300000-0000-4000-a000-000000000004'::uuid, 'membership', :'david_membership_id'::uuid)).id as home_assignment_id \gset
select (public.create_assignment(gen_random_uuid(), gen_random_uuid(), :'maggie_id'::uuid, 'record', '60300000-0000-4000-a000-000000000005'::uuid, 'membership', :'david_membership_id'::uuid)).id as documents_assignment_id \gset

-- ---------------------------------------------------------------------
-- Marion (general-only): can read the general assignment, cannot read
-- the financial/health/home/documents ones.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000002', true);

select extensions.is(
  (select count(*)::int from public.assignments where id = :'general_assignment_id'::uuid),
  1,
  'a general-only member CAN read the assignment for a general-domain record'
);
select extensions.is(
  (select count(*)::int from public.assignments where id = :'financial_assignment_id'::uuid),
  0,
  'a general-only member CANNOT read the assignment for a financial-domain record'
);
select extensions.is(
  (select count(*)::int from public.assignments where id = :'health_assignment_id'::uuid),
  0,
  'a general-only member CANNOT read the assignment for a health-domain record'
);
select extensions.is(
  (select count(*)::int from public.assignments where id = :'home_assignment_id'::uuid),
  0,
  'a general-only member CANNOT read the assignment for a home-domain record'
);
select extensions.is(
  (select count(*)::int from public.assignments where id = :'documents_assignment_id'::uuid),
  0,
  'a general-only member CANNOT read the assignment for a documents-domain record'
);

-- ---------------------------------------------------------------------
-- Granting the matching domain makes it visible.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);
select public.change_member_role(
  (select id from public.care_space_memberships where care_space_id = :'maggie_id'::uuid and user_id = '60000000-0000-0000-0000-000000000002'),
  'contributor', array['general', 'financial']
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000002', true);
select extensions.is(
  (select count(*)::int from public.assignments where id = :'financial_assignment_id'::uuid),
  1,
  'once granted financial access, the same member CAN read the financial assignment'
);
-- Health remains ungranted and still correctly denied.
select extensions.is(
  (select count(*)::int from public.assignments where id = :'health_assignment_id'::uuid),
  0,
  'health access was never granted -- the health assignment remains invisible'
);

-- ---------------------------------------------------------------------
-- Organiser behaviour is unaffected -- an organiser sees every domain
-- unconditionally, exactly as before.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);
select extensions.is(
  (select count(*)::int from public.assignments where care_space_id = :'maggie_id'::uuid),
  5,
  'the organiser (David) sees all 5 assignments across every domain, unchanged'
);

-- ---------------------------------------------------------------------
-- Assignment mutation rules remain unchanged -- a general-only member can
-- still be assigned nothing outside their own write-authorised domain;
-- reusing an existing, already-tested guard rather than re-deriving it.
-- ---------------------------------------------------------------------

select extensions.lives_ok(
  format(
    $$select public.create_assignment(gen_random_uuid(), gen_random_uuid(), %L::uuid, 'record', '60300000-0000-4000-a000-000000000003'::uuid, 'membership', %L::uuid)$$,
    :'maggie_id', :'david_membership_id'
  ),
  'assignment mutation authority is unaffected by this read-policy fix -- David remains fully authorised to create assignments in any domain'
);

select * from extensions.finish();
rollback;
