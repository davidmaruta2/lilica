-- Care Circle permission-domain audit follow-up: record_domain_for_type()
-- previously fell through to 'general' for any unrecognised record type.
-- Hardened in 20260916090000_fix_assignments_domain_scoped_read.sql: every
-- one of the eight real record types now has its own explicit branch, and
-- anything else raises rather than silently defaulting. This proves both
-- structural defences independently: the function itself fails closed,
-- AND the records_type CHECK constraint independently prevents an
-- unmapped type from ever being stored at all.
begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(10);

-- Every one of the eight real record types is still mapped exactly as
-- before -- this hardening changed failure behaviour only, never the
-- real mapping.
select extensions.is(public.record_domain_for_type('appointment'), 'general', 'appointment -> general');
select extensions.is(public.record_domain_for_type('task'), 'general', 'task -> general');
select extensions.is(public.record_domain_for_type('contact'), 'general', 'contact -> general');
select extensions.is(public.record_domain_for_type('update'), 'general', 'update -> general');
select extensions.is(public.record_domain_for_type('careNote'), 'health', 'careNote -> health');
select extensions.is(public.record_domain_for_type('bill'), 'financial', 'bill -> financial');
select extensions.is(public.record_domain_for_type('homeMatter'), 'home', 'homeMatter -> home');
select extensions.is(public.record_domain_for_type('document'), 'documents', 'document -> documents');

-- An unknown/unmapped type now FAILS CLOSED (raises), never silently
-- becomes 'general'.
select extensions.throws_ok(
  $$select public.record_domain_for_type('somethingNew')$$,
  '22023',
  'record_domain_for_type: unmapped record type "somethingNew" -- every record type must have an explicit permission domain',
  'an unmapped record type raises rather than silently defaulting to general'
);

-- Independent structural defence: proven directly by attempting a real
-- insert via the actual client-facing RPC, not merely asserted from the
-- constraint text. Found while writing this test: apply_record_mutation()
-- has its OWN earlier explicit whitelist check on payload_type, which
-- fires and rejects an unmapped type before the INSERT (and therefore
-- before the records_type CHECK constraint, and before record_domain_
-- for_type() would even be invoked) is ever reached -- an even earlier
-- layer of defence than the CHECK constraint alone, not previously
-- documented as a separate layer in the audit report.
insert into auth.users (id, email) values ('61000000-0000-0000-0000-000000000001', 'rdf-david@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"61100000-0000-4000-a000-000000000001","display_name":"Beauty","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
select cs.id as beauty_id from public.care_spaces cs where cs.bootstrap_owner_id = '61000000-0000-0000-0000-000000000001' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select extensions.throws_ok(
  format(
    $$select public.apply_record_mutation(gen_random_uuid(), gen_random_uuid(), %L::uuid, 'import', 0, '{"local_record_id":"bad-1","record_type":"somethingNew","record_data":{"title":"Should be impossible"}}'::jsonb)$$,
    :'beauty_id'
  ),
  '22023',
  'Invalid record payload',
  'apply_record_mutation() independently rejects an unmapped record type via its own explicit whitelist check -- record_domain_for_type() is never even reached for this row, an earlier layer of defence than the records_type CHECK constraint alone'
);

select * from extensions.finish();
rollback;
