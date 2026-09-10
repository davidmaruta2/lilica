begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(40);

select extensions.has_table('public', 'records', 'records table exists');
select extensions.has_table('public', 'record_mutation_receipts', 'mutation receipt table exists');
select extensions.has_column('public', 'records', 'record_domain', 'records have server-derived domain');
select extensions.has_column('public', 'records', 'sensitivity', 'records have server-derived sensitivity');
select extensions.has_column('public', 'records', 'legacy_responsibility_text', 'legacy responsibility text is separate');
select extensions.is((select relrowsecurity from pg_class where oid = 'public.records'::regclass), true, 'records use RLS');
select extensions.is((select relforcerowsecurity from pg_class where oid = 'public.records'::regclass), true, 'records force RLS');

insert into auth.users (id, email)
values
  ('a0000000-0000-0000-0000-000000000001', 'records-a@example.test'),
  ('b0000000-0000-0000-0000-000000000002', 'records-b@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"a7000000-0000-4000-a000-000000000001","display_name":"Jackie","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

select extensions.lives_ok(
  $$ select public.apply_record_mutation(
       'a7100000-0000-4000-a000-000000000001',
       'a7200000-0000-4000-a000-000000000001',
       (select id from public.care_spaces limit 1),
       'import', 0,
       '{"local_record_id":"appointment-legacy-1","record_type":"appointment","record_data":{"title":"Dentist"},"legacy_responsibility_text":"Sarah","attachment_manifest":[]}'::jsonb
     ) $$,
  'organiser can import a record into an authorised care space'
);
select extensions.is((select count(*) from public.records), 1::bigint, 'organiser reads own record');
select extensions.is((select record_domain from public.records limit 1), 'general', 'appointment classification is server-derived');
select extensions.is((select sensitivity from public.records limit 1), 'standard', 'appointment sensitivity is server-derived');
select extensions.is((select legacy_responsibility_text from public.records limit 1), 'Sarah', 'legacy responsibility is preserved exactly');
select extensions.is((select responsibility_source from public.records limit 1), 'legacy_local_record', 'legacy responsibility provenance is preserved');
select extensions.is((select source from public.records limit 1), 'phase1_import', 'import provenance is server-derived');

select extensions.is(
  (select public.apply_record_mutation(
    'a7100000-0000-4000-a000-000000000001',
    'a7200000-0000-4000-a000-000000000001',
    (select id from public.care_spaces limit 1),
    'import', 0,
    '{"local_record_id":"appointment-legacy-1","record_type":"appointment","record_data":{"title":"Dentist"},"legacy_responsibility_text":"Sarah","attachment_manifest":[]}'::jsonb
  )->>'status'),
  'duplicate',
  'replaying an acknowledged operation is idempotent'
);
select extensions.is((select count(*) from public.records), 1::bigint, 'idempotent retry creates no duplicate record');

select extensions.is(
  (select public.apply_record_mutation(
    'a7100000-0000-4000-a000-000000000002',
    'a7200000-0000-4000-a000-000000000001',
    (select id from public.care_spaces limit 1),
    'update', 1,
    '{"local_record_id":"appointment-legacy-1","record_type":"appointment","record_data":{"title":"Dentist moved"},"legacy_responsibility_text":"Sarah","attachment_manifest":[]}'::jsonb
  )->>'status'),
  'applied',
  'organiser can update an authorised current record'
);
select extensions.is((select version from public.records limit 1), 2, 'server advances record version');
select extensions.is(
  (select public.apply_record_mutation(
    'a7100000-0000-4000-a000-000000000003',
    'a7200000-0000-4000-a000-000000000001',
    (select id from public.care_spaces limit 1),
    'update', 1,
    '{"local_record_id":"appointment-legacy-1","record_type":"appointment","record_data":{"title":"Stale edit"},"attachment_manifest":[]}'::jsonb
  )->>'status'),
  'conflict',
  'stale update is preserved as a conflict instead of last-write-wins'
);
select extensions.is((select record_data->>'title' from public.records limit 1), 'Dentist moved', 'stale update does not overwrite server data');
select extensions.is(
  (select public.apply_record_mutation(
    'a7100000-0000-4000-a000-000000000006',
    'a7200000-0000-4000-a000-000000000001',
    (select id from public.care_spaces limit 1),
    'update', 1,
    '{"local_record_id":"appointment-legacy-1","record_type":"appointment","record_data":{"title":"Dentist","notes":"Bring letter"},"legacy_responsibility_text":"Sarah","attachment_manifest":[],"base_record_data":{"title":"Dentist"},"base_legacy_responsibility_text":"Sarah","base_attachment_manifest":[]}'::jsonb
  )->>'status'),
  'applied',
  'non-overlapping stale fields merge against an explicit base snapshot'
);
select extensions.is(
  (select record_data from public.records limit 1),
  '{"title":"Dentist moved","notes":"Bring letter"}'::jsonb,
  'compatible merge preserves both device changes'
);

select extensions.throws_ok(
  $$ update public.records set care_space_id = gen_random_uuid() $$,
  '42501', 'permission denied for table records',
  'ordinary client cannot rewrite record ownership'
);
select extensions.throws_ok(
  $$ update public.records set record_type = 'task' $$,
  '42501', 'permission denied for table records',
  'ordinary client cannot forge classification'
);
select extensions.throws_ok(
  $$ update public.records set created_by_membership_id = gen_random_uuid() $$,
  '42501', 'permission denied for table records',
  'ordinary client cannot forge audit ownership'
);
select extensions.throws_ok(
  $$ delete from public.records $$,
  '42501', 'permission denied for table records',
  'ordinary client cannot hard-delete records'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"b7000000-0000-4000-a000-000000000001","display_name":"Brian","relationship_type":"Dad","relationship_label":null}
]'::jsonb);
select extensions.is((select count(*) from public.records), 0::bigint, 'other user cannot read records across care spaces');
select extensions.throws_ok(
  $$ select public.apply_record_mutation(
       'b7100000-0000-4000-a000-000000000001',
       'b7200000-0000-4000-a000-000000000001',
       (select id from public.care_spaces where bootstrap_owner_id = 'a0000000-0000-0000-0000-000000000001'),
       'create', 0,
       '{"local_record_id":"intruder","record_type":"task","record_data":{"title":"Nope"},"attachment_manifest":[]}'::jsonb
     ) $$,
  '42501', 'Active care-space membership required',
  'other user cannot create in an unauthorised care space'
);
select extensions.throws_ok(
  $$ update public.records set record_data = '{"title":"Nope"}'::jsonb $$,
  '42501', 'permission denied for table records',
  'other user cannot update records'
);
select extensions.throws_ok(
  $$ insert into public.records (
       id, care_space_id, local_record_id, record_type, record_data, source,
       created_by_membership_id, updated_by_membership_id
     ) select gen_random_uuid(), id, 'intruder', 'task', '{}'::jsonb, 'native', gen_random_uuid(), gen_random_uuid()
       from public.care_spaces limit 1 $$,
  '42501', 'permission denied for table records',
  'other user cannot directly insert records'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select extensions.throws_ok($$ select * from public.records $$, '42501', 'permission denied for table records', 'anonymous record read is denied');
select extensions.throws_ok(
  $$ select public.apply_record_mutation(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'create', 0, '{}'::jsonb) $$,
  '42501', 'permission denied for function apply_record_mutation',
  'anonymous mutation is denied'
);
select extensions.throws_ok(
  $$ insert into public.records (id, care_space_id, local_record_id, record_type, source, created_by_membership_id, updated_by_membership_id)
     values (gen_random_uuid(), gen_random_uuid(), 'anon', 'task', 'native', gen_random_uuid(), gen_random_uuid()) $$,
  '42501', 'permission denied for table records',
  'anonymous insert is denied'
);
select extensions.throws_ok($$ update public.records set record_data = '{}'::jsonb $$, '42501', 'permission denied for table records', 'anonymous update is denied');
select extensions.throws_ok($$ delete from public.records $$, '42501', 'permission denied for table records', 'anonymous delete is denied');

reset role;
set local role postgres;
update public.care_space_memberships
set membership_status = 'revoked'
where user_id = 'a0000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select extensions.is((select count(*) from public.records), 0::bigint, 'revoked membership immediately loses record reads');
select extensions.throws_ok(
  $$ select public.apply_record_mutation(
       'a7100000-0000-4000-a000-000000000004',
       'a7200000-0000-4000-a000-000000000001',
       (select id from public.care_spaces where bootstrap_owner_id = 'a0000000-0000-0000-0000-000000000001'),
       'delete', 3, null
     ) $$,
  '42501', 'Active care-space membership required',
  'revoked membership cannot mutate stale local records'
);

reset role;
set local role postgres;
update public.care_space_memberships
set membership_status = 'active'
where user_id = 'a0000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
select extensions.is(
  (select public.apply_record_mutation(
    'a7100000-0000-4000-a000-000000000005',
    'a7200000-0000-4000-a000-000000000001',
    (select id from public.care_spaces limit 1),
    'delete', 3, null
  )->>'status'),
  'applied',
  'authorised remove creates a tombstone'
);
select extensions.is((select count(*) from public.records where deleted_at is not null), 1::bigint, 'record remains as a tombstone rather than hard deletion');
select extensions.is((select version from public.records limit 1), 4, 'tombstone advances server version');

select * from extensions.finish();
rollback;
