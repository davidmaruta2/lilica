begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(26);

insert into auth.users (id, email)
values
  ('20000000-0000-0000-0000-000000000001', 'p20b-david@example.test'),
  ('20000000-0000-0000-0000-000000000002', 'p20b-sarah@example.test'),
  ('20000000-0000-0000-0000-000000000003', 'p20b-jackie@example.test');

-- ---------------------------------------------------------------------
-- Setup: David bootstraps Beauty; Jackie bootstraps an unrelated space
-- ("Jackie's Space") for the cross-space isolation checks below.
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"20100000-0000-4000-a000-000000000001","display_name":"Beauty","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"20100000-0000-4000-a000-000000000003","display_name":"Jackie Space","relationship_type":"Myself","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
insert into public.profiles (id, display_name) values
  ('20000000-0000-0000-0000-000000000001', 'David'),
  ('20000000-0000-0000-0000-000000000002', 'Sarah'),
  ('20000000-0000-0000-0000-000000000003', 'Jackie')
on conflict (id) do update set display_name = excluded.display_name;

-- David invites Sarah as contributor with ONLY the 'general' domain --
-- deliberately excludes 'financial', to prove permission filtering below.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select public.invite_member(
  (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'),
  'p20b-sarah@example.test', 'contributor', array['general'], 'Other relative', 'Aunt', '20700000-0000-4000-a000-000000000001'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), '20800000-0000-4000-a000-000000000001');

-- ---------------------------------------------------------------------
-- 1. member_joined was logged for Sarah's acceptance.
-- ---------------------------------------------------------------------

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.care_space_activity
    where event_type = 'member_joined'
      and actor_membership_id = (select id from public.care_space_memberships where user_id = '20000000-0000-0000-0000-000000000002')),
  1,
  'accepting an invitation logs exactly one member_joined event, attributed to the joining membership'
);

-- ---------------------------------------------------------------------
-- 2. record_created: a genuine creation logs a truthful event.
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select public.apply_record_mutation(
  '20200000-0000-4000-a000-000000000001', '20300000-0000-4000-a000-000000000001',
  (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'),
  'import', 0, '{"local_record_id":"task-1","record_type":"task","record_data":{"title":"Arrange transport"}}'::jsonb
);

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.care_space_activity where event_type = 'record_created' and metadata->>'title' = 'Arrange transport'),
  1,
  'a genuine record creation logs exactly one truthful record_created event'
);

-- A financial-domain record too, for the permission-filtering test below.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select public.apply_record_mutation(
  '20200000-0000-4000-a000-000000000002', '20300000-0000-4000-a000-000000000002',
  (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'),
  'import', 0, '{"local_record_id":"bill-1","record_type":"bill","record_data":{"title":"Water bill"}}'::jsonb
);

-- ---------------------------------------------------------------------
-- 3. record_completed (a bill being "marked paid" is just completion on
--    a bill-typed record -- exactly what the brief's "David marked
--    Council Tax paid" example describes).
-- ---------------------------------------------------------------------

select public.apply_record_mutation(
  '20200000-0000-4000-a000-000000000003', '20300000-0000-4000-a000-000000000002',
  (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'),
  'update', 1, '{"local_record_id":"bill-1","record_type":"bill","record_data":{"title":"Water bill","completed":true}}'::jsonb
);

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.care_space_activity where event_type = 'record_completed' and record_id = (select id from public.records where local_record_id = 'bill-1')),
  1,
  'marking a bill paid (completed=true) logs exactly one record_completed event'
);

-- ---------------------------------------------------------------------
-- 4. record_reopened.
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select public.apply_record_mutation(
  '20200000-0000-4000-a000-000000000004', '20300000-0000-4000-a000-000000000002',
  (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'),
  'update', 2, '{"local_record_id":"bill-1","record_type":"bill","record_data":{"title":"Water bill","completed":false}}'::jsonb
);

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.care_space_activity where event_type = 'record_reopened' and record_id = (select id from public.records where local_record_id = 'bill-1')),
  1,
  'reopening a completed item logs exactly one record_reopened event'
);

-- ---------------------------------------------------------------------
-- 5. assignment_changed: assigning the general-domain task to Sarah.
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select public.apply_record_mutation(
  '20200000-0000-4000-a000-000000000005', '20300000-0000-4000-a000-000000000001',
  (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'),
  'update', 1,
  jsonb_build_object(
    'local_record_id', 'task-1', 'record_type', 'task',
    'record_data', jsonb_build_object('title', 'Arrange transport', 'assignedMembershipId', (select id from public.care_space_memberships where user_id = '20000000-0000-0000-0000-000000000002')::text)
  )
);

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.care_space_activity where event_type = 'assignment_changed' and record_id = (select id from public.records where local_record_id = 'task-1')),
  1,
  'assigning a record to a domain-eligible member logs exactly one assignment_changed event'
);

-- ---------------------------------------------------------------------
-- 6. date_changed: changing the task's due date (no completion/assignment
--    change in the same edit).
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select public.apply_record_mutation(
  '20200000-0000-4000-a000-000000000006', '20300000-0000-4000-a000-000000000001',
  (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'),
  'update', 2,
  jsonb_build_object(
    'local_record_id', 'task-1', 'record_type', 'task',
    'record_data', jsonb_build_object(
      'title', 'Arrange transport', 'dueDate', '2026-09-20',
      'assignedMembershipId', (select id from public.care_space_memberships where user_id = '20000000-0000-0000-0000-000000000002')::text
    )
  )
);

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.care_space_activity where event_type = 'date_changed' and record_id = (select id from public.records where local_record_id = 'task-1')),
  1,
  'changing a record''s due date (with nothing else meaningful changing) logs exactly one date_changed event'
);

-- ---------------------------------------------------------------------
-- 7. A plain, non-meaningful edit (notes only) produces NO new activity
--    row at all -- "no technical sync noise".
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select public.apply_record_mutation(
  '20200000-0000-4000-a000-000000000007', '20300000-0000-4000-a000-000000000001',
  (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'),
  'update', 3,
  jsonb_build_object(
    'local_record_id', 'task-1', 'record_type', 'task',
    'record_data', jsonb_build_object(
      'title', 'Arrange transport', 'dueDate', '2026-09-20', 'notes', 'Call the taxi firm first',
      'assignedMembershipId', (select id from public.care_space_memberships where user_id = '20000000-0000-0000-0000-000000000002')::text
    )
  )
);

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.care_space_activity where record_id = (select id from public.records where local_record_id = 'task-1')),
  3,
  'a plain notes-only edit adds no new activity row -- still exactly the 3 prior meaningful events (record_created, assignment_changed, date_changed) for this record'
);

-- ---------------------------------------------------------------------
-- 8. document_uploaded, only on a genuine transition into 'uploaded'.
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select public.apply_record_mutation(
  '20200000-0000-4000-a000-000000000008', '20300000-0000-4000-a000-000000000004',
  (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'),
  'import', 0, '{"local_record_id":"doc-1","record_type":"document","record_data":{"title":"Hospital letter"}}'::jsonb
);
select public.upsert_record_attachment(
  '20400000-0000-4000-a000-000000000001',
  (select id from public.records where local_record_id = 'doc-1'),
  (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'),
  'file', 'Hospital letter.pdf', 'application/pdf', 12345, 'beauty/doc-1/file.pdf'
);
select public.mark_attachment_upload_status('20400000-0000-4000-a000-000000000001', 'uploaded');

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.care_space_activity where event_type = 'document_uploaded'),
  1,
  'a genuine byte-confirmed upload logs exactly one document_uploaded event'
);

-- Idempotent retry: marking already-'uploaded' as 'uploaded' again must
-- not duplicate the event.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select public.mark_attachment_upload_status('20400000-0000-4000-a000-000000000001', 'uploaded');

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.care_space_activity where event_type = 'document_uploaded'),
  1,
  'retrying mark_attachment_upload_status with an already-uploaded status does not duplicate the activity event'
);

-- ---------------------------------------------------------------------
-- 9. apply_record_mutation idempotent retry: replaying the SAME
--    operation_id for the original task creation must not duplicate its
--    record_created event.
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select public.apply_record_mutation(
  '20200000-0000-4000-a000-000000000001', '20300000-0000-4000-a000-000000000001',
  (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'),
  'import', 0, '{"local_record_id":"task-1","record_type":"task","record_data":{"title":"Arrange transport"}}'::jsonb
);

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.care_space_activity where event_type = 'record_created' and metadata->>'title' = 'Arrange transport'),
  1,
  'replaying the same create operation_id (an outbox retry) does not duplicate its record_created event'
);

-- ---------------------------------------------------------------------
-- 10. list_recent_activity: permission filtering. Sarah (general-only)
--     must see the general-domain task events but NOT the financial-
--     domain bill events, even though both are in the same care space.
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select extensions.is(
  (select count(*)::int from public.list_recent_activity((select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'), null, 100) where event_type in ('record_completed', 'record_reopened')),
  0,
  'a contributor without financial-domain access sees zero financial-domain (bill) activity events'
);
select extensions.ok(
  (select count(*)::int from public.list_recent_activity((select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'), null, 100) where event_type = 'assignment_changed') > 0,
  'the same contributor DOES see general-domain (task) activity events they have access to'
);

-- ---------------------------------------------------------------------
-- 11. Organiser sees everything, including the financial-domain events.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select extensions.ok(
  (select count(*)::int from public.list_recent_activity((select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'), null, 100) where event_type = 'record_completed') > 0,
  'the organiser sees financial-domain activity events too (unconditional organiser access, unchanged)'
);

-- ---------------------------------------------------------------------
-- 12. Cross-space isolation: nobody sees Jackie's activity from Beauty's
--     care space, and vice versa.
-- ---------------------------------------------------------------------

select public.apply_record_mutation(
  '20200000-0000-4000-a000-000000000009', '20300000-0000-4000-a000-000000000005',
  (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'),
  'import', 0, '{"local_record_id":"beauty-only-1","record_type":"contact","record_data":{"title":"Beauty GP"}}'::jsonb
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
select public.apply_record_mutation(
  '20200000-0000-4000-a000-000000000010', '20300000-0000-4000-a000-000000000006',
  (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000003'),
  'import', 0, '{"local_record_id":"jackie-only-1","record_type":"contact","record_data":{"title":"Jackie GP"}}'::jsonb
);

select extensions.is(
  (select count(*)::int from public.list_recent_activity((select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000003'), null, 100) where metadata->>'title' = 'Beauty GP'),
  0,
  'Jackie''s own care-space activity feed never contains an event from Beauty''s care space'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select extensions.is(
  (select count(*)::int from public.list_recent_activity((select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'), null, 100) where metadata->>'title' = 'Jackie GP'),
  0,
  'Beauty''s own care-space activity feed never contains an event from Jackie''s unrelated care space'
);

-- ---------------------------------------------------------------------
-- 13. member_removed / revoked-member denial / former-member truthful
--     historical attribution.
-- ---------------------------------------------------------------------

select public.remove_member((select id from public.care_space_memberships where user_id = '20000000-0000-0000-0000-000000000002'));

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.care_space_activity where event_type = 'member_removed' and actor_membership_id = (select id from public.care_space_memberships where user_id = '20000000-0000-0000-0000-000000000002')),
  1,
  'removing a member logs exactly one member_removed event, attributed to the removed membership'
);

-- A revoked member gets NOTHING back from list_recent_activity for this
-- care space, even for the events truthfully attributed to them.
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select extensions.is(
  (select count(*)::int from public.list_recent_activity((select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'), null, 100)),
  0,
  'a revoked (removed) member''s own list_recent_activity call for that care space returns nothing -- security access does not survive removal'
);

-- The remaining organiser still truthfully sees Sarah's historical
-- attribution on the assignment_changed event she was assigned in --
-- historical attribution survives even though her access does not.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select extensions.is(
  (select actor_display_name from public.list_recent_activity((select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'), null, 100) where event_type = 'member_removed'),
  'Sarah',
  'a removed member''s historical activity still resolves their true display name to the organiser (historical attribution survives revocation)'
);

-- ---------------------------------------------------------------------
-- 14. Immutability: no update or delete is ever permitted on the table.
-- ---------------------------------------------------------------------

reset role;
set local role postgres;
select extensions.throws_ok(
  $$ update public.care_space_activity set event_type = 'record_reopened' where event_type = 'record_created' $$,
  '42501',
  'Activity events are immutable',
  'no row in care_space_activity can ever be updated, even as postgres'
);
select extensions.throws_ok(
  $$ delete from public.care_space_activity where event_type = 'record_created' $$,
  '42501',
  'Activity events are immutable',
  'no row in care_space_activity can ever be deleted, even as postgres'
);

-- ---------------------------------------------------------------------
-- 15. Unauthenticated (anon) rejection, matching every other RPC's
--     established convention in this schema.
-- ---------------------------------------------------------------------

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select extensions.throws_ok(
  $$ select public.list_recent_activity('00000000-0000-0000-0000-000000000000'::uuid, null, 20) $$,
  '42501',
  'permission denied for function list_recent_activity',
  'anon has no execute grant on list_recent_activity at all'
);
select extensions.throws_ok(
  $$ select * from public.care_space_activity $$,
  '42501',
  'permission denied for table care_space_activity',
  'anon has no select grant on care_space_activity at all'
);

-- ---------------------------------------------------------------------
-- 16. Bounded pagination: page_size is respected and clamped.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select extensions.is(
  (select count(*)::int from public.list_recent_activity((select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'), null, 2)),
  2,
  'list_recent_activity honours a small page_size (bounded/paginated rendering)'
);
select extensions.ok(
  (select count(*)::int from public.list_recent_activity((select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'), null, 500)) <= 100,
  'list_recent_activity clamps an oversized page_size request to a safe maximum'
);

-- Cursor pagination: paging past the most recent 2 events with
-- before_created_at never re-returns them.
select extensions.ok(
  not exists (
    select 1 from public.list_recent_activity(
      (select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'),
      (select min(created_at) from public.list_recent_activity((select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'), null, 2)),
      100
    ) newer
    where newer.created_at >= (select min(created_at) from public.list_recent_activity((select id from public.care_spaces where bootstrap_owner_id = '20000000-0000-0000-0000-000000000001'), null, 2))
  ),
  'cursor-based pagination (before_created_at) never re-returns an already-seen page'
);

select extensions.is(
  (select event_type from public.care_space_activity where record_id is null and event_type = 'member_joined' limit 1),
  'member_joined',
  'member-lifecycle events are stored with record_id null, distinct from record-scoped events'
);

select * from extensions.finish();
rollback;
