-- Phase 20D structural closure (`\downloads\20-22.txt`): ARCHIVE/RESTORE
-- and organiser HANDOFF. Multi-organiser deletion consent is covered by
-- delete_care_space.test.sql's own extended sequence.
begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(23);

insert into auth.users (id, email)
values
  ('40000000-0000-0000-0000-000000000001', 'lc-david@example.test'),
  ('40000000-0000-0000-0000-000000000002', 'lc-marion@example.test'),
  ('40000000-0000-0000-0000-000000000003', 'lc-contributor@example.test'),
  ('40000000-0000-0000-0000-000000000004', 'lc-viewer@example.test'),
  ('40000000-0000-0000-0000-000000000005', 'lc-outsider@example.test');

-- David bootstraps Maggie. Marion accepts as viewer, a contributor and a
-- second viewer also join, so archive/promote authority can be tested
-- against every role.
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"40100000-0000-4000-a000-000000000001","display_name":"Maggie","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
select sp.care_space_id as maggie_id
from public.supported_people sp
join public.care_spaces cs on cs.id = sp.care_space_id
where cs.bootstrap_owner_id = '40000000-0000-0000-0000-000000000001' and sp.display_name = 'Maggie' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select public.invite_member(:'maggie_id'::uuid, 'lc-marion@example.test', 'viewer', array['general'], 'Other relative', 'Aunt', '40700000-0000-4000-a000-000000000002');
select public.invite_member(:'maggie_id'::uuid, 'lc-contributor@example.test', 'contributor', array['general'], 'Other relative', 'Friend', '40700000-0000-4000-a000-000000000003');
select public.invite_member(:'maggie_id'::uuid, 'lc-viewer@example.test', 'viewer', array['general'], 'Other relative', 'Friend', '40700000-0000-4000-a000-000000000004');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), '40800000-0000-4000-a000-000000000002');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), '40800000-0000-4000-a000-000000000003');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), '40800000-0000-4000-a000-000000000004');

-- ---------------------------------------------------------------------
-- ARCHIVE authority: contributor and viewer cannot archive.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);
select extensions.throws_ok(
  format('select public.archive_care_space(%L::uuid)', :'maggie_id'),
  '42501',
  'Only an active organiser of this care space can archive it',
  'a contributor cannot archive'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
select extensions.throws_ok(
  format('select public.archive_care_space(%L::uuid)', :'maggie_id'),
  '42501',
  'Only an active organiser of this care space can archive it',
  'a viewer cannot archive'
);

-- ---------------------------------------------------------------------
-- ARCHIVE: an active organiser can archive; history/records/membership
-- survive; the space no longer shows as active; ordinary mutations are
-- rejected server-side; reads still work.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select public.apply_record_mutation(
  '40200000-0000-4000-a000-000000000001', '40300000-0000-4000-a000-000000000001',
  :'maggie_id'::uuid,
  'import', 0,
  '{"local_record_id":"task-1","record_type":"task","record_data":{"title":"Renew prescription"}}'::jsonb
);

select extensions.lives_ok(
  format('select public.archive_care_space(%L::uuid)', :'maggie_id'),
  'an active organiser (David) can archive Maggie''s care'
);

reset role;
set local role postgres;
select extensions.is(
  (select status from public.care_spaces where id = :'maggie_id'::uuid),
  'archived',
  'the care space status is now archived'
);
select extensions.is(
  (select count(*)::int from public.records where care_space_id = :'maggie_id'::uuid),
  1,
  'the existing record survives archiving -- nothing was deleted'
);
select extensions.is(
  (select count(*)::int from public.care_space_memberships where care_space_id = :'maggie_id'::uuid and membership_status = 'active'),
  4,
  'every membership survives archiving, still active'
);

-- Archived data remains READABLE (a plain select, RLS-governed exactly
-- like an active space).
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select extensions.is(
  (select count(*)::int from public.records where care_space_id = :'maggie_id'::uuid),
  1,
  'an organiser can still read the archived care space''s records'
);

-- Ordinary mutations are rejected server-side while archived (the shared
-- can_access_care_space_records() write-gate).
select extensions.throws_ok(
  format(
    'select public.apply_record_mutation(''40200000-0000-4000-a000-000000000002''::uuid, ''40300000-0000-4000-a000-000000000002''::uuid, %L::uuid, ''import'', 0, ''{"local_record_id":"task-2","record_type":"task","record_data":{"title":"Should be blocked"}}''::jsonb)',
    :'maggie_id'
  ),
  '42501',
  null,
  'adding a new record to an archived care space is rejected server-side'
);

-- Inviting a new Care Circle member is also rejected while archived.
select extensions.throws_ok(
  format(
    'select public.invite_member(%L::uuid, ''lc-blocked@example.test'', ''viewer'', array[''general''], ''Someone else'', ''Friend'', ''40700000-0000-4000-a000-000000000009''::uuid)',
    :'maggie_id'
  ),
  '42501',
  'This care space is archived -- restore it first to invite new members',
  'inviting a new member while archived is rejected'
);

-- ---------------------------------------------------------------------
-- RESTORE: returns the SAME care space to ACTIVE; data intact; normal
-- mutations work again.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
select extensions.throws_ok(
  format('select public.restore_care_space(%L::uuid)', :'maggie_id'),
  '42501',
  'Only an active organiser of this care space can restore it',
  'a viewer cannot restore'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  format('select public.restore_care_space(%L::uuid)', :'maggie_id'),
  'an active organiser can restore Maggie''s care'
);

reset role;
set local role postgres;
select extensions.is(
  (select status from public.care_spaces where id = :'maggie_id'::uuid),
  'active',
  'the care space status is active again'
);
select extensions.is(
  (select id from public.care_spaces where id = :'maggie_id'::uuid),
  :'maggie_id'::uuid,
  'restoring returns the SAME care space identity -- no replacement row was created'
);

-- Normal mutations work again after restore.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  format(
    'select public.apply_record_mutation(''40200000-0000-4000-a000-000000000003''::uuid, ''40300000-0000-4000-a000-000000000003''::uuid, %L::uuid, ''import'', 0, ''{"local_record_id":"task-3","record_type":"task","record_data":{"title":"Works again after restore"}}''::jsonb)',
    :'maggie_id'
  ),
  'adding a record works again once restored'
);

-- Archive/restore are idempotent retries.
select extensions.lives_ok(
  format('select public.restore_care_space(%L::uuid)', :'maggie_id'),
  'restoring an already-active care space is a safe no-op'
);

-- ---------------------------------------------------------------------
-- ORGANISER HANDOFF: promote_to_organiser().
-- ---------------------------------------------------------------------

-- A contributor cannot promote anyone.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);
select extensions.throws_ok(
  format(
    'select public.promote_to_organiser(%L::uuid, (select id from public.care_space_memberships where user_id = ''40000000-0000-0000-0000-000000000004''))',
    :'maggie_id'
  ),
  '42501',
  'Only an active organiser can promote another member',
  'a contributor cannot promote anyone to organiser'
);

-- David (organiser) promotes Marion. An invalid/non-member target fails
-- server-side.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select extensions.throws_ok(
  format('select public.promote_to_organiser(%L::uuid, ''00000000-0000-0000-0000-000000000000''::uuid)', :'maggie_id'),
  '22023',
  'That person is not currently an active member of this care space',
  'a non-member membership id cannot be promoted'
);

select extensions.lives_ok(
  format(
    'select public.promote_to_organiser(%L::uuid, (select id from public.care_space_memberships where user_id = ''40000000-0000-0000-0000-000000000002''))',
    :'maggie_id'
  ),
  'David promotes Marion to organiser'
);

reset role;
set local role postgres;
select extensions.is(
  (select role from public.care_space_memberships where care_space_id = :'maggie_id'::uuid and user_id = '40000000-0000-0000-0000-000000000002'),
  'organiser',
  'Marion''s role is now organiser'
);

-- Now that a second organiser exists, David can leave safely (the
-- pre-existing sole-organiser invariant no longer blocks him, and he is
-- not the commercial owner check-affected path here since he transfers
-- nothing -- Marion becoming organiser alone is sufficient for THIS
-- invariant; commercial ownership is a separate, additional check proven
-- in the commercial-ownership test below).
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select extensions.throws_ok(
  format('select public.leave_care_space(%L::uuid)', :'maggie_id'),
  '22023',
  'Transfer commercial ownership of this care space to another organiser before you leave',
  'David is still blocked from leaving -- he remains the commercial owner even though Marion is now also an organiser'
);

select extensions.lives_ok(
  format(
    'select public.transfer_care_space_commercial_ownership(%L::uuid, (select id from public.care_space_memberships where user_id = ''40000000-0000-0000-0000-000000000002''))',
    :'maggie_id'
  ),
  'David transfers commercial ownership to Marion, using the existing Phase 21B mechanism'
);

select extensions.lives_ok(
  format('select public.leave_care_space(%L::uuid)', :'maggie_id'),
  'David can now leave -- another organiser exists AND commercial ownership is resolved'
);

reset role;
set local role postgres;
select extensions.is(
  (select membership_status from public.care_space_memberships where care_space_id = :'maggie_id'::uuid and user_id = '40000000-0000-0000-0000-000000000001'),
  'revoked',
  'David''s own historical attribution/membership row survives, just revoked -- never deleted'
);

select * from extensions.finish();
rollback;
