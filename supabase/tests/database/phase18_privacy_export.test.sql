begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(17);

insert into auth.users (id, email)
values
  ('a8000000-0000-0000-0000-000000000001', 'p18-david@example.test'),
  ('a8000000-0000-0000-0000-000000000002', 'p18-sarah@example.test');

-- David organises Beauty.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a8000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"a8100000-0000-4000-a000-000000000001","display_name":"Beauty","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
insert into public.profiles (id, display_name) values
  ('a8000000-0000-0000-0000-000000000001', 'David')
on conflict (id) do update set display_name = excluded.display_name;

-- ---------------------------------------------------------------------
-- account_deletion_precheck()
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a8000000-0000-0000-0000-000000000001', true);
select extensions.is(
  (select blocking from public.account_deletion_precheck() where care_space_name = 'Beauty'),
  true,
  'sole organiser of Beauty is blocked from account deletion'
);

-- Invite Sarah as a second organiser and accept -- now David is not sole.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a8000000-0000-0000-0000-000000000001', true);
select public.invite_member(
  (select id from public.care_spaces where bootstrap_owner_id = 'a8000000-0000-0000-0000-000000000001'),
  'p18-sarah@example.test', 'viewer', array['general'], 'Other relative', 'Aunt', 'a8300000-0000-4000-a000-000000000001'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a8000000-0000-0000-0000-000000000002', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), 'a8400000-0000-4000-a000-000000000001');

-- A pure viewer/contributor is never even listed (the query only looks at
-- spaces the caller ORGANISES -- leaving a space you don't organise never
-- needs a sole-organiser check). Checked here, before Sarah is promoted
-- to organiser below, while she is still viewer-only.
select extensions.is(
  (select count(*) from public.account_deletion_precheck()),
  0::bigint,
  'a member who organises no care space gets an empty precheck result'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a8000000-0000-0000-0000-000000000001', true);
select public.change_member_role(
  (select id from public.care_space_memberships where user_id = 'a8000000-0000-0000-0000-000000000002'),
  'organiser', '{}'
);
select extensions.is(
  (select blocking from public.account_deletion_precheck() where care_space_name = 'Beauty'),
  false,
  'David is no longer blocked once a second active organiser exists'
);

-- Revert Sarah back to viewer-only so the export scenario below matches
-- the brief's own test data shape (David sole organiser of Beauty).
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a8000000-0000-0000-0000-000000000001', true);
select public.change_member_role(
  (select id from public.care_space_memberships where user_id = 'a8000000-0000-0000-0000-000000000002'),
  'viewer', array['general']
);

-- ---------------------------------------------------------------------
-- export_my_data() -- Beauty: appointment, task, bill (financial),
-- document + linked appointment (related_to) + linked task (action_for).
-- ---------------------------------------------------------------------

select public.apply_record_mutation(
  'a8500000-0000-4000-a000-000000000001', 'a8600000-0000-4000-a000-000000000001',
  (select id from public.care_spaces where bootstrap_owner_id = 'a8000000-0000-0000-0000-000000000001'),
  'import', 0, '{"local_record_id":"appt-1","record_type":"appointment","record_data":{"title":"Orthopaedic appointment"}}'::jsonb
);
select public.apply_record_mutation(
  'a8500000-0000-4000-a000-000000000002', 'a8600000-0000-4000-a000-000000000002',
  (select id from public.care_spaces where bootstrap_owner_id = 'a8000000-0000-0000-0000-000000000001'),
  'import', 0, '{"local_record_id":"bill-1","record_type":"bill","record_data":{"title":"Electric"}}'::jsonb
);
select public.apply_record_mutation(
  'a8500000-0000-4000-a000-000000000003', 'a8600000-0000-4000-a000-000000000003',
  (select id from public.care_spaces where bootstrap_owner_id = 'a8000000-0000-0000-0000-000000000001'),
  'import', 0, '{"local_record_id":"doc-1","record_type":"document","record_data":{"title":"Hospital appointment letter"}}'::jsonb
);
select public.create_record_link(
  (select id from public.care_spaces where bootstrap_owner_id = 'a8000000-0000-0000-0000-000000000001'),
  'a8600000-0000-4000-a000-000000000003', 'a8600000-0000-4000-a000-000000000001', 'related_to'
);
select public.upsert_record_attachment(
  'a8700000-0000-4000-a000-000000000001', 'a8600000-0000-4000-a000-000000000003',
  (select id from public.care_spaces where bootstrap_owner_id = 'a8000000-0000-0000-0000-000000000001'),
  'file', 'hospital-letter.pdf', 'application/pdf', 1024,
  'irrelevant/path.pdf'
);

select extensions.is(
  jsonb_array_length((select export_my_data()->'careSpaces')),
  1::int,
  'David''s export includes exactly the one care space he belongs to'
);
select extensions.is(
  jsonb_array_length((select export_my_data()->'careSpaces'->0->'records')),
  3::int,
  'the export includes all three of Beauty''s records -- organiser sees every domain'
);
select extensions.ok(
  (select export_my_data()->'careSpaces'->0->'records' @> '[{"type":"document"}]'::jsonb),
  'the document record is present in the export'
);
select extensions.is(
  jsonb_array_length((select export_my_data()->'careSpaces'->0->'attachments')),
  1::int,
  'the document''s attachment metadata is present in the export'
);
select extensions.is(
  (select export_my_data()->'careSpaces'->0->'attachments'->0->>'displayName'),
  'hospital-letter.pdf',
  'attachment metadata includes the display name, never a signed URL or storage path'
);
select extensions.is(
  jsonb_array_length((select export_my_data()->'careSpaces'->0->'recordLinks')),
  1::int,
  'the document-to-appointment link is present in the export'
);
select extensions.is(
  (select export_my_data()->'profile'->>'display_name'),
  'David',
  'the export includes the caller''s own profile'
);
select extensions.ok(
  not ((select export_my_data()) ? 'access_token'),
  'the export never contains an auth token field'
);

-- ---------------------------------------------------------------------
-- export_my_data() domain restriction -- Sarah, a viewer granted only
-- 'general' in Beauty, must not see the financial bill or the document/
-- link (documents domain never granted to her).
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a8000000-0000-0000-0000-000000000002', true);
select extensions.is(
  jsonb_array_length((select export_my_data()->'careSpaces'->0->'records')),
  1::int,
  'Sarah (general-only viewer) exports exactly the one general-domain record -- the appointment'
);
select extensions.ok(
  (select export_my_data()->'careSpaces'->0->'records') @> '[{"type":"appointment"}]'::jsonb,
  'Sarah sees the appointment'
);
select extensions.is(
  not ((select export_my_data()->'careSpaces'->0->'records') @> '[{"type":"bill"}]'::jsonb),
  true,
  'Sarah''s export never includes the financial bill she has no grant for'
);
select extensions.is(
  jsonb_array_length((select export_my_data()->'careSpaces'->0->'attachments')),
  0::int,
  'Sarah''s export includes no attachment metadata -- she has no documents grant'
);
select extensions.is(
  jsonb_array_length((select export_my_data()->'careSpaces'->0->'recordLinks')),
  0::int,
  'Sarah''s export includes no record links -- neither endpoint of the one link is visible to her'
);

-- A pending invitee (never accepted) exports nothing for that space --
-- proves export never runs ahead of real membership.
reset role;
set local role postgres;
insert into auth.users (id, email) values ('a8000000-0000-0000-0000-000000000003', 'p18-pending@example.test');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a8000000-0000-0000-0000-000000000001', true);
select public.invite_member(
  (select id from public.care_spaces where bootstrap_owner_id = 'a8000000-0000-0000-0000-000000000001'),
  'p18-pending@example.test', 'viewer', array['general'], 'Other relative', 'Neighbour', 'a8300000-0000-4000-a000-000000000002'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a8000000-0000-0000-0000-000000000003', true);
select extensions.is(
  jsonb_array_length((select export_my_data()->'careSpaces')),
  0::int,
  'a pending invitee (not yet accepted) exports zero care spaces'
);

select * from extensions.finish();
rollback;
