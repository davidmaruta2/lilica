-- Post-build implementation batch (lilbatch.txt, 17 September 2026):
-- structured Medical Log -- diagnosed conditions and prescribed medicines.
-- Proves both new record types are accepted end-to-end through the real
-- client-facing RPC (not merely asserted against the CHECK constraint
-- text), map to the 'health' domain exactly like careNote, and are
-- rejected for a Care Circle member with no health-domain grant --
-- mirroring record_domain_fail_closed.test.sql's own style/structure.
begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(9);

select extensions.is(public.record_domain_for_type('condition'), 'health', 'condition -> health');
select extensions.is(public.record_domain_for_type('medicine'), 'health', 'medicine -> health');

insert into auth.users (id, email)
values
  ('91000000-0000-0000-0000-000000000001', 'medlog-organiser@example.test'),
  ('91000000-0000-0000-0000-000000000002', 'medlog-viewer-general@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"91100000-0000-4000-a000-000000000001","display_name":"Rosa","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
select cs.id as rosa_id from public.care_spaces cs where cs.bootstrap_owner_id = '91000000-0000-0000-0000-000000000001' \gset
insert into public.profiles (id, display_name) values
  ('91000000-0000-0000-0000-000000000001', 'Organiser Omar'),
  ('91000000-0000-0000-0000-000000000002', 'General-only Gina')
on conflict (id) do update set display_name = excluded.display_name;

-- The organiser can create a real diagnosed condition and a real
-- prescribed medicine, proving the CHECK constraint and
-- apply_record_mutation()'s own whitelist both accept the new types.
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  format(
    $$select public.apply_record_mutation(gen_random_uuid(), gen_random_uuid(), %L::uuid, 'create', 0, '{"local_record_id":"condition-1","record_type":"condition","record_data":{"title":"Type 2 diabetes","closedAt":null}}'::jsonb)$$,
    :'rosa_id'
  ),
  'a diagnosed condition can be created through apply_record_mutation()'
);
select extensions.lives_ok(
  format(
    $$select public.apply_record_mutation(gen_random_uuid(), gen_random_uuid(), %L::uuid, 'create', 0, '{"local_record_id":"medicine-1","record_type":"medicine","record_data":{"title":"Metformin","medicineSchedule":"repeat"}}'::jsonb)$$,
    :'rosa_id'
  ),
  'a prescribed medicine can be created through apply_record_mutation()'
);
select extensions.is((select count(*) from public.records where record_type = 'condition'), 1::bigint, 'exactly one condition record now exists');
select extensions.is((select count(*) from public.records where record_type = 'medicine'), 1::bigint, 'exactly one medicine record now exists');

-- Invite a second member with ONLY the general domain (never health) --
-- the same permission model every other health record already enforces.
select extensions.lives_ok(
  format(
    $$select public.invite_member(%L::uuid, 'medlog-viewer-general@example.test', 'viewer', array['general'], 'Other relative', 'Friend', gen_random_uuid()) $$,
    :'rosa_id'
  ),
  'organiser can invite a general-only viewer'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
select extensions.lives_ok(
  $$select public.accept_invitation((select id from public.list_my_invitations() limit 1), gen_random_uuid())$$,
  'the general-only viewer accepts the invitation'
);

-- A general-only member has no read access to the health domain, so any
-- attempt to write a condition/medicine into this care space must fail --
-- exactly the same server-authoritative enforcement as careNote already
-- has, never a second permission system for Medical Log.
select extensions.throws_ok(
  format(
    $$select public.apply_record_mutation(gen_random_uuid(), gen_random_uuid(), %L::uuid, 'create', 0, '{"local_record_id":"condition-2","record_type":"condition","record_data":{"title":"Should be refused"}}'::jsonb)$$,
    :'rosa_id'
  ),
  '42501',
  'Insufficient permission for this record domain',
  'a member without the health domain granted cannot create a condition record'
);

select * from extensions.finish();
rollback;
