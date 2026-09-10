begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(57);

select extensions.has_table('public', 'occurrences', 'occurrences table exists');
select extensions.has_table('public', 'occurrence_versions', 'occurrence history table exists');
select extensions.has_table('public', 'recurrence_series', 'recurrence series table exists');
select extensions.has_table('public', 'recurrence_rules', 'immutable recurrence rules table exists');
select extensions.has_table('public', 'assignments', 'assignment foundation exists');
select extensions.has_table('public', 'care_space_contacts', 'external contact foundation exists');
select extensions.is((select relrowsecurity from pg_class where oid = 'public.occurrences'::regclass), true, 'occurrences use RLS');
select extensions.is((select relforcerowsecurity from pg_class where oid = 'public.occurrences'::regclass), true, 'occurrences force RLS');

insert into auth.users (id, email)
values
  ('c0000000-0000-0000-0000-000000000001', 'phase8-a@example.test'),
  ('d0000000-0000-0000-0000-000000000002', 'phase8-b@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"c7000000-0000-4000-a000-000000000001","display_name":"Jackie","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
insert into public.profiles (id, display_name)
values ('c0000000-0000-0000-0000-000000000001', 'David Phase Eight')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);

select extensions.lives_ok(
  $$ select public.apply_record_mutation(
       'c7100000-0000-4000-a000-000000000001',
       'c7200000-0000-4000-a000-000000000001',
       (select id from public.care_spaces where bootstrap_owner_id = 'c0000000-0000-0000-0000-000000000001'),
       'import', 0,
       '{"local_record_id":"appointment-legacy-1","record_type":"appointment","record_data":{"title":"Dentist","eventDate":"2026-10-31","eventTime":"10:30","recurrence":{"unit":"month","interval":1}},"legacy_responsibility_text":"Sarah","attachment_manifest":[{"id":"file-1","kind":"file","name":"letter.pdf","createdAt":"2026-09-01T09:00:00.000Z"}]}'::jsonb
     ) $$,
  'Phase 7 record mutation atomically creates its canonical occurrence'
);
select extensions.is((select count(*) from public.occurrences), 1::bigint, 'one dated record creates one occurrence');
select extensions.is(
  (select id from public.occurrences),
  'a447d7ae-d186-4598-a5a5-c3c3d4d4e6e6'::uuid,
  'occurrence identity matches the client deterministic UUID contract'
);
select extensions.is(
  (select occurrence.record_id from public.occurrences occurrence),
  'c7200000-0000-4000-a000-000000000001'::uuid,
  'occurrence retains its parent record identity'
);
select extensions.is(
  (select occurrence.care_space_id = record.care_space_id from public.occurrences occurrence join public.records record on record.id = occurrence.record_id),
  true,
  'occurrence ownership matches parent care space'
);
select extensions.is((select occurrence_kind from public.occurrences), 'event', 'appointment maps to event semantics');
select extensions.is((select timing_kind from public.occurrences), 'local_datetime', 'appointment wall time stays local date/time');
select extensions.is((select starts_on from public.occurrences), '2026-10-31'::date, 'local appointment date is preserved');
select extensions.is((select starts_time from public.occurrences), '10:30'::time, 'local appointment time is preserved');
select extensions.is((select timezone from public.occurrences), 'Europe/London', 'local appointment timezone is explicit');
select extensions.is((select status from public.occurrences), 'scheduled', 'a passed clock cannot silently mutate appointment outcome');
select extensions.is((select legacy_responsibility_text from public.records), 'Sarah', 'legacy responsibility remains descriptive text');
select extensions.is((select count(*) from public.assignments), 0::bigint, 'legacy responsibility never creates an assignment by name');
select extensions.is((select count(*) from public.recurrence_series), 1::bigint, 'recurring record creates one stable series');
select extensions.is((select count(*) from public.recurrence_rules), 1::bigint, 'recurring record creates one immutable rule version');
select extensions.is(
  (select public.apply_record_mutation(
    'c7100000-0000-4000-a000-000000000001',
    'c7200000-0000-4000-a000-000000000001',
    (select care_space_id from public.records where id = 'c7200000-0000-4000-a000-000000000001'),
    'import', 0,
    '{"local_record_id":"appointment-legacy-1","record_type":"appointment","record_data":{"title":"Dentist","eventDate":"2026-10-31","eventTime":"10:30","recurrence":{"unit":"month","interval":1}},"legacy_responsibility_text":"Sarah","attachment_manifest":[]}'::jsonb
  )->>'status'),
  'duplicate',
  'lost record acknowledgement retries idempotently'
);
select extensions.is((select count(*) from public.occurrences), 1::bigint, 'record retry creates no duplicate occurrence');

select extensions.lives_ok(
  $$ select public.apply_record_mutation(
    'c7100000-0000-4000-a000-000000000010',
    'c7200000-0000-4000-a000-000000000010',
    (select care_space_id from public.records where id = 'c7200000-0000-4000-a000-000000000001'),
    'import', 0,
    '{"local_record_id":"partial-legacy","record_type":"task","record_data":{"title":"Partial","dueDate":"not-a-date","completed":true,"completedAt":"also-invalid"},"legacy_responsibility_text":"Unknown helper","attachment_manifest":[{"id":"file-partial","kind":"file","name":"partial.pdf","createdAt":"2026-09-01T09:00:00.000Z"}]}'::jsonb
  ) $$,
  'malformed partial historical data migrates without inventing a date'
);
select extensions.is((select count(*) from public.occurrences), 1::bigint, 'malformed date creates no fabricated occurrence');
select extensions.is(
  (select attachment_manifest->0->>'name' from public.records where id = 'c7200000-0000-4000-a000-000000000010'),
  'partial.pdf',
  'partial historical attachment metadata is preserved'
);
select extensions.is(
  (select public.apply_record_mutation(
    'c7100000-0000-4000-a000-000000000010',
    'c7200000-0000-4000-a000-000000000010',
    (select care_space_id from public.records where id = 'c7200000-0000-4000-a000-000000000010'),
    'import', 0,
    '{}'::jsonb
  )->>'status'),
  'duplicate',
  'interrupted partial migration resumes using the original operation identity'
);
select extensions.is((select count(*) from public.occurrences), 1::bigint, 'repeated partial migration creates no duplicate occurrence');

select extensions.is(
  (select public.apply_record_mutation(
    'c7100000-0000-4000-a000-000000000002',
    'c7200000-0000-4000-a000-000000000001',
    (select care_space_id from public.records where id = 'c7200000-0000-4000-a000-000000000001'),
    'update', 1,
    '{"local_record_id":"appointment-legacy-1","record_type":"appointment","record_data":{"title":"Dentist moved","eventDate":"2026-10-31","eventTime":"11:00","recurrence":{"unit":"month","interval":1}},"legacy_responsibility_text":"Sarah","attachment_manifest":[{"id":"file-1","kind":"file","name":"letter.pdf","createdAt":"2026-09-01T09:00:00.000Z"}]}'::jsonb
  )->>'status'),
  'applied',
  'record edit updates the canonical occurrence'
);
select extensions.is((select count(*) from public.occurrences), 1::bigint, 'record edit preserves occurrence identity');
select extensions.is((select starts_time from public.occurrences), '11:00'::time, 'record edit changes current expectation');
select extensions.is((select count(*) from public.occurrence_versions), 1::bigint, 'old occurrence expectation is retained in immutable history');
select extensions.is(
  (select snapshot->>'starts_time' from public.occurrence_versions limit 1),
  '10:30:00',
  'history answers what time was previously expected'
);
select extensions.is(
  (select attachment_manifest->0->>'name' from public.records where id = 'c7200000-0000-4000-a000-000000000001'),
  'letter.pdf',
  'attachment manifest survives occurrence migration and edits'
);

select extensions.throws_ok(
  $$ update public.occurrences set care_space_id = gen_random_uuid() $$,
  '42501', 'permission denied for table occurrences',
  'client cannot move an occurrence to another care space'
);
select extensions.throws_ok(
  $$ update public.occurrences set record_id = gen_random_uuid() $$,
  '42501', 'permission denied for table occurrences',
  'client cannot relink an occurrence or forge ownership fields'
);

select extensions.is(
  (select public.apply_occurrence_mutation(
    'c7300000-0000-4000-a000-000000000001',
    (select id from public.occurrences where sequence = 0),
    (select care_space_id from public.occurrences where sequence = 0),
    'complete', (select version from public.occurrences where sequence = 0), '{}'::jsonb
  )->>'status'),
  'applied',
  'organiser can complete a current occurrence'
);
select extensions.is((select status from public.occurrences where sequence = 0), 'completed', 'completion is explicit domain truth');
select extensions.is((select count(*) from public.occurrences), 2::bigint, 'completion creates exactly one next recurrence');
select extensions.is((select starts_on from public.occurrences where sequence = 1), '2026-11-30'::date, 'month-end recurrence clamps deterministically');
select extensions.is(
  (select public.apply_occurrence_mutation(
    'c7300000-0000-4000-a000-000000000001',
    (select id from public.occurrences where sequence = 0),
    (select care_space_id from public.occurrences where sequence = 0),
    'complete', 2, '{}'::jsonb
  )->>'status'),
  'duplicate',
  'lost occurrence acknowledgement retries idempotently'
);
select extensions.is((select count(*) from public.occurrences), 2::bigint, 'occurrence retry creates no duplicate next recurrence');

select extensions.lives_ok(
  $$ select public.create_assignment(
    'c7400000-0000-4000-a000-000000000001',
    'c7500000-0000-4000-a000-000000000001',
    (select care_space_id from public.occurrences limit 1),
    'occurrence', (select id from public.occurrences where sequence = 1),
    'membership', (select id from public.care_space_memberships where user_id = 'c0000000-0000-0000-0000-000000000001')
  ) $$,
  'organiser can assign using stable membership identity'
);
select extensions.is((select count(*) from public.assignments), 1::bigint, 'one assignment row is created');
select extensions.is(
  (select membership_id from public.assignments),
  (select id from public.care_space_memberships where user_id = 'c0000000-0000-0000-0000-000000000001'),
  'assignment identity is membership UUID, not display name'
);
select extensions.is((select display_name_snapshot from public.assignments), 'David Phase Eight', 'assignment preserves a display snapshot');

reset role;
set local role postgres;
update public.profiles set display_name = 'Renamed Organiser'
where id = 'c0000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select extensions.is((select display_name_snapshot from public.assignments), 'David Phase Eight', 'profile rename does not change assignment identity or historical snapshot');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"d7000000-0000-4000-a000-000000000001","display_name":"Brian","relationship_type":"Dad","relationship_label":null}
]'::jsonb);
select extensions.is((select count(*) from public.occurrences), 0::bigint, 'other authenticated user cannot read occurrences');
select extensions.is((select count(*) from public.assignments), 0::bigint, 'assignment grants no cross-care-space visibility');
select extensions.throws_ok(
  $$ select public.apply_occurrence_mutation(
    gen_random_uuid(),
    public.phase8_stable_uuid('phase8-occurrence|c7200000-0000-4000-a000-000000000001|1'),
    (select id from public.care_spaces where bootstrap_owner_id = 'c0000000-0000-0000-0000-000000000001'),
    'cancel', 1, '{}'::jsonb
  ) $$,
  '42501', 'Active care-space membership required',
  'cross-care-space occurrence mutation is denied'
);
select extensions.throws_ok(
  $$ select public.create_assignment(
    gen_random_uuid(), gen_random_uuid(),
    (select id from public.care_spaces where bootstrap_owner_id = 'c0000000-0000-0000-0000-000000000001'),
    'occurrence', public.phase8_stable_uuid('phase8-occurrence|c7200000-0000-4000-a000-000000000001|1'),
    'membership', (select id from public.care_space_memberships where user_id = 'd0000000-0000-0000-0000-000000000002')
  ) $$,
  '42501', 'Active care-space membership required',
  'cross-space assignment is denied'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select extensions.throws_ok($$ select * from public.occurrences $$, '42501', 'permission denied for table occurrences', 'anonymous occurrence access is denied');
select extensions.throws_ok(
  $$ select public.apply_occurrence_mutation(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'complete', 1, '{}'::jsonb) $$,
  '42501', 'permission denied for function apply_occurrence_mutation',
  'anonymous occurrence mutation is denied'
);

reset role;
set local role postgres;
update public.care_space_memberships set membership_status = 'revoked'
where user_id = 'c0000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', true);
select extensions.is((select count(*) from public.occurrences), 0::bigint, 'revoked membership immediately loses occurrence reads');
select extensions.throws_ok(
  $$ select public.apply_occurrence_mutation(
    gen_random_uuid(), public.phase8_stable_uuid('phase8-occurrence|c7200000-0000-4000-a000-000000000001|1'),
    (select id from public.care_spaces where bootstrap_owner_id = 'c0000000-0000-0000-0000-000000000001'),
    'cancel', 1, '{}'::jsonb
  ) $$,
  '42501', 'Active care-space membership required',
  'revoked membership cannot mutate occurrences'
);

select * from extensions.finish();
rollback;
