begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(36);

insert into auth.users (id, email)
values
  ('21000000-0000-0000-0000-000000000001', 'p21b-david@example.test'),
  ('21000000-0000-0000-0000-000000000002', 'p21b-marion@example.test'),
  ('21000000-0000-0000-0000-000000000003', 'p21b-jackie@example.test'),
  ('21000000-0000-0000-0000-000000000004', 'p21b-outsider@example.test');

-- ---------------------------------------------------------------------
-- 1. First bootstrap starts the trial, exactly +60 days, and sets
--    commercial_owner_id. A SECOND person in the SAME initial call does
--    NOT create a second entitlement row or a second trial_started event.
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"21100000-0000-4000-a000-000000000001","display_name":"Beauty","relationship_type":"Mum","relationship_label":null},
  {"draft_id":"21100000-0000-4000-a000-000000000002","display_name":"Jackie Home","relationship_type":"Dad","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
insert into public.profiles (id, display_name) values
  ('21000000-0000-0000-0000-000000000001', 'David'),
  ('21000000-0000-0000-0000-000000000002', 'Marion'),
  ('21000000-0000-0000-0000-000000000003', 'Jackie'),
  ('21000000-0000-0000-0000-000000000004', 'Outsider')
on conflict (id) do update set display_name = excluded.display_name;

select extensions.is(
  (select count(*)::int from public.entitlements where user_id = '21000000-0000-0000-0000-000000000001'),
  1,
  'exactly one entitlement row is created for the account across a multi-person first bootstrap call'
);
select extensions.is(
  (select count(*)::int from public.entitlement_events where user_id = '21000000-0000-0000-0000-000000000001' and event_type = 'trial_started'),
  1,
  'exactly one trial_started event is logged, not one per supported person'
);
select extensions.is(
  (select (trial_expires_at - trial_started_at) from public.entitlements where user_id = '21000000-0000-0000-0000-000000000001'),
  interval '60 days',
  'trial_expires_at is exactly 60 days after trial_started_at'
);
select extensions.is(
  (select status from public.entitlements where user_id = '21000000-0000-0000-0000-000000000001'),
  'TRIAL_ACTIVE',
  'a freshly bootstrapped account starts TRIAL_ACTIVE'
);
select extensions.is(
  (select count(*)::int from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and commercial_owner_id = '21000000-0000-0000-0000-000000000001'),
  2,
  'BOTH care spaces from the same first bootstrap call receive commercial_owner_id = the bootstrapping account (multi-person, one entitlement)'
);

-- ---------------------------------------------------------------------
-- 2. Idempotent retry: replaying the exact same bootstrap payload (same
--    draft_ids) must not create a second entitlement, restart the trial,
--    or change commercial ownership.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"21100000-0000-4000-a000-000000000001","display_name":"Beauty","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.entitlements where user_id = '21000000-0000-0000-0000-000000000001'),
  1,
  'retrying bootstrap with an already-processed draft_id does not create a second entitlement row'
);
select extensions.is(
  (select count(*)::int from public.entitlement_events where user_id = '21000000-0000-0000-0000-000000000001' and event_type = 'trial_started'),
  1,
  'retrying bootstrap does not restart the trial (still exactly one trial_started event)'
);

-- ---------------------------------------------------------------------
-- 3. Active-entitlement write succeeds; reads/export-adjacent RPCs are
--    entirely unaffected by entitlement state.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$ select public.apply_record_mutation(
    '21200000-0000-4000-a000-000000000001', '21300000-0000-4000-a000-000000000001',
    (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'),
    'import', 0, '{"local_record_id":"task-1","record_type":"task","record_data":{"title":"Arrange transport"}}'::jsonb
  ) $$,
  'a create mutation succeeds while the commercial owner is TRIAL_ACTIVE'
);

-- ---------------------------------------------------------------------
-- 4. Expired entitlement blocks the exact same mutation shape, but never
--    blocks reads or account-control actions.
-- ---------------------------------------------------------------------

reset role;
set local role postgres;
update public.entitlements set status = 'TRIAL_EXPIRED', trial_expires_at = now() - interval '1 day'
where user_id = '21000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select extensions.throws_ok(
  $$ select public.apply_record_mutation(
    '21200000-0000-4000-a000-000000000002', '21300000-0000-4000-a000-000000000002',
    (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'),
    'import', 0, '{"local_record_id":"task-2","record_type":"task","record_data":{"title":"Another task"}}'::jsonb
  ) $$,
  '42501', 'Subscription required to continue managing this care space',
  'a create mutation is rejected once the commercial owner is TRIAL_EXPIRED'
);
select extensions.lives_ok(
  $$ select count(*) from public.records where care_space_id = (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001') $$,
  'ordinary reads remain fully available while expired'
);
select extensions.lives_ok(
  $$ select public.export_my_data() $$,
  'export_my_data() is never entitlement-gated'
);
select extensions.lives_ok(
  $$ select public.account_deletion_precheck() $$,
  'account_deletion_precheck() is never entitlement-gated'
);

-- Re-adding a second supported person while expired is blocked (brief
-- section 30/section 11 -- creation of an ADDITIONAL care space after the
-- first trial-starting bootstrap requires active entitlement).
select extensions.throws_ok(
  $$ select * from public.bootstrap_supported_people('[{"draft_id":"21100000-0000-4000-a000-000000000099","display_name":"New Person","relationship_type":"Other relative","relationship_label":"Uncle"}]'::jsonb) $$,
  '42501', 'Subscribe to add another supported person',
  'bootstrapping a genuinely NEW care space is blocked once the account''s own entitlement has expired'
);

-- Restore active entitlement for the remaining tests below.
reset role;
set local role postgres;
update public.entitlements set status = 'TRIAL_ACTIVE', trial_expires_at = now() + interval '60 days'
where user_id = '21000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------
-- 5. Collaborator inheritance: Marion (contributor, general domain) can
--    mutate Beauty while David (commercial owner) is entitled; once
--    David's entitlement expires, Marion is blocked even though her OWN
--    Care Circle permission is unchanged and even though she has never
--    had any entitlement row of her own.
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select public.invite_member(
  (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'),
  'p21b-marion@example.test', 'contributor', array['general'], 'Other relative', 'Aunt', '21700000-0000-4000-a000-000000000001'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000002', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), '21800000-0000-4000-a000-000000000001');

select extensions.lives_ok(
  $$ select public.apply_record_mutation(
    '21200000-0000-4000-a000-000000000003', '21300000-0000-4000-a000-000000000003',
    (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'),
    'import', 0, '{"local_record_id":"marion-task-1","record_type":"task","record_data":{"title":"Marion helps out"}}'::jsonb
  ) $$,
  'a collaborator (no entitlement row of her own) can mutate an entitled care space she has permission for'
);

-- Create Jackie's invitation NOW, while David is still entitled -- invite_member()
-- itself requires active entitlement (creating a new collaboration
-- relationship is active management), so this must happen before the
-- expiry below in order to test accept_invitation()'s own, deliberately
-- different, never-gated behaviour.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select public.invite_member(
  (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'),
  'p21b-jackie@example.test', 'viewer', array['general'], 'Other relative', 'Cousin', '21700000-0000-4000-a000-000000000099'
);

reset role;
set local role postgres;
update public.entitlements set status = 'TRIAL_EXPIRED', trial_expires_at = now() - interval '1 day'
where user_id = '21000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000002', true);
select extensions.throws_ok(
  $$ select public.apply_record_mutation(
    '21200000-0000-4000-a000-000000000004', '21300000-0000-4000-a000-000000000004',
    (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'),
    'import', 0, '{"local_record_id":"marion-task-2","record_type":"task","record_data":{"title":"Blocked"}}'::jsonb
  ) $$,
  '42501', 'Subscription required to continue managing this care space',
  'the SAME collaborator is blocked once the care space''s commercial owner (David) expires -- her own permission is unaffected, only the commercial gate changed'
);

-- invite_member() itself is correctly blocked while expired (creating a
-- NEW invitation is active management, brief section 13). Back to David's
-- own context -- the previous assertion above deliberately left the
-- session authenticated as Marion.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select extensions.throws_ok(
  $$ select public.invite_member(
    (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'),
    'p21b-outsider@example.test', 'viewer', array['general'], 'Other relative', 'Neighbour', '21700000-0000-4000-a000-000000000098'
  ) $$,
  '42501', 'Subscription required to continue managing this care space',
  'invite_member() is blocked once the care space is commercially expired'
);

-- ---------------------------------------------------------------------
-- 6. Accepting an already-issued invitation, leaving, and organiser
--    removal-for-safety all remain possible while the care space is
--    commercially expired (brief sections 13/14).
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok(
  $$ select public.accept_invitation((select id from public.list_my_invitations() limit 1), '21800000-0000-4000-a000-000000000002') $$,
  'accepting an already-issued invitation succeeds even while the care space is commercially expired'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok(
  $$ select public.leave_care_space((select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001')) $$,
  'leaving a care space succeeds even while it is commercially expired -- never trapping a collaborator'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$ select public.remove_member((select id from public.care_space_memberships where user_id = '21000000-0000-0000-0000-000000000002' and care_space_id = (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'))) $$,
  'an organiser removing a member succeeds even while the care space is commercially expired (safety/account-control action)'
);

-- change_member_role, by contrast, IS entitlement-gated (an active
-- permission-management action, not a safety exit).
select extensions.throws_ok(
  $$ select public.change_member_role(
    (select id from public.care_space_memberships where user_id = '21000000-0000-0000-0000-000000000001' and care_space_id = (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001')),
    'contributor', array['general']
  ) $$,
  '42501', 'Subscription required to continue managing this care space',
  'change_member_role() is blocked once the care space is commercially expired'
);

-- Restore active entitlement before the transfer/isolation/deletion tests.
reset role;
set local role postgres;
update public.entitlements set status = 'TRIAL_ACTIVE', trial_expires_at = now() + interval '60 days'
where user_id = '21000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------
-- 7. Commercial ownership transfer: valid (current owner self-transfers
--    to an active organiser) and invalid (target not an active organiser)
--    cases.
-- ---------------------------------------------------------------------

-- Make Jackie a second organiser of Beauty first, so there is a valid
-- transfer target.
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select public.invite_member(
  (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'),
  'p21b-jackie@example.test', 'viewer', array['general'], 'Other relative', 'Cousin', '21700000-0000-4000-a000-000000000097'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000003', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), '21800000-0000-4000-a000-000000000003');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select public.change_member_role(
  (select id from public.care_space_memberships where user_id = '21000000-0000-0000-0000-000000000003' and care_space_id = (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001')),
  'organiser', array['general','health','financial','home','documents']
);

-- Invalid transfer: target is not an active organiser of this care space.
select extensions.throws_ok(
  $$ select public.transfer_care_space_commercial_ownership(
    (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'),
    '00000000-0000-0000-0000-000000000000'
  ) $$,
  '22023', 'The new commercial owner must be an active organiser of this care space',
  'transferring to a membership id that is not an active organiser of this care space is rejected'
);

-- Valid transfer: David (current owner) explicitly transfers to Jackie
-- (now an active organiser).
select public.transfer_care_space_commercial_ownership(
  (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'),
  (select id from public.care_space_memberships where user_id = '21000000-0000-0000-0000-000000000003' and care_space_id = (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'))
);

reset role;
set local role postgres;
select extensions.is(
  (select commercial_owner_id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'),
  '21000000-0000-0000-0000-000000000003'::uuid,
  'commercial ownership genuinely transferred to Jackie'
);
select extensions.is(
  (select count(*)::int from public.entitlement_events where user_id = '21000000-0000-0000-0000-000000000003' and event_type = 'ownership_transferred'),
  1,
  'the transfer is recorded as an audited entitlement event'
);

-- Jackie has no entitlement of her own -- Beauty is now read-only (Care
-- Circle roles/permissions are completely untouched by the transfer).
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select extensions.throws_ok(
  $$ select public.apply_record_mutation(
    '21200000-0000-4000-a000-000000000005', '21300000-0000-4000-a000-000000000005',
    (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'),
    'import', 0, '{"local_record_id":"post-transfer","record_type":"task","record_data":{"title":"After transfer"}}'::jsonb
  ) $$,
  '42501', 'Subscription required to continue managing this care space',
  'after transfer, Beauty is read-only because the NEW owner (Jackie) has no active entitlement of her own'
);
select extensions.is(
  (select role::text from public.care_space_memberships where user_id = '21000000-0000-0000-0000-000000000001' and care_space_id = (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001')),
  'organiser',
  'David remains an organiser after the commercial-ownership transfer -- Care Circle roles are never touched by it'
);

-- ---------------------------------------------------------------------
-- 8. Former owner: once ownership is transferred away, the former
--    owner's own OTHER care space (Jackie Home) is unaffected -- proves
--    entitlement is genuinely per-care-space via commercial_owner_id, not
--    accidentally shared or cached globally per account.
-- ---------------------------------------------------------------------

reset role;
set local role postgres;
update public.entitlements set status = 'TRIAL_ACTIVE', trial_expires_at = now() + interval '60 days'
where user_id = '21000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$ select public.apply_record_mutation(
    '21200000-0000-4000-a000-000000000006', '21300000-0000-4000-a000-000000000006',
    (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000002'),
    'import', 0, '{"local_record_id":"jackie-home-task","record_type":"task","record_data":{"title":"Still David''s own space"}}'::jsonb
  ) $$,
  'David''s OTHER, still-self-owned care space (Jackie Home) is unaffected by transferring Beauty away -- entitlement is per-care-space, not a single global flag'
);

-- ---------------------------------------------------------------------
-- 9. Cross-space isolation: a completely unrelated care space's
--    entitlement (or lack thereof) never affects Beauty''s own gate.
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000004', true);
select * from public.bootstrap_supported_people('[{"draft_id":"21100000-0000-4000-a000-000000000004","display_name":"Outsider Space","relationship_type":"Myself","relationship_label":null}]'::jsonb);

reset role;
set local role postgres;
update public.entitlements set status = 'REVOKED' where user_id = '21000000-0000-0000-0000-000000000004';
-- Give Jackie (Beauty's new commercial owner as of the transfer above) her
-- own genuine active entitlement, so this test actually exercises "her
-- OWN entitlement, unaffected by an unrelated outsider's revocation" --
-- rather than accidentally exercising "no entitlement at all", which
-- would be a real (and different) read-only state, not what this
-- assertion is testing.
insert into public.entitlements (user_id, status, trial_started_at, trial_expires_at)
values ('21000000-0000-0000-0000-000000000003', 'TRIAL_ACTIVE', statement_timestamp(), statement_timestamp() + interval '60 days');

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok(
  $$ select public.apply_record_mutation(
    '21200000-0000-4000-a000-000000000007', '21300000-0000-4000-a000-000000000007',
    (select id from public.care_spaces where bootstrap_owner_id = '21000000-0000-0000-0000-000000000001' and bootstrap_id = '21100000-0000-4000-a000-000000000001'),
    'update', 1, jsonb_build_object('local_record_id', 'task-1', 'record_type', 'task', 'record_data', jsonb_build_object('title', 'Arrange transport', 'notes', 'Jackie can still edit Beauty'))
  ) $$,
  'Beauty''s own entitlement (now Jackie''s, active) is completely unaffected by an unrelated outsider''s revoked entitlement on a different care space'
);

-- ---------------------------------------------------------------------
-- 10. Entitlement immutability / client-forgery denial: no authenticated
--     client can write to entitlements or entitlement_events directly,
--     regardless of whose row they target.
-- ---------------------------------------------------------------------

select extensions.throws_ok(
  $$ update public.entitlements set status = 'SUBSCRIPTION_ACTIVE' where user_id = '21000000-0000-0000-0000-000000000003' $$,
  '42501', 'permission denied for table entitlements',
  'an authenticated client (even the row''s own owner) cannot directly forge their own entitlement status'
);
select extensions.throws_ok(
  $$ insert into public.entitlement_events (id, user_id, event_type, metadata) values (gen_random_uuid(), '21000000-0000-0000-0000-000000000003', 'purchase_verified', '{}'::jsonb) $$,
  '42501', 'permission denied for table entitlement_events',
  'an authenticated client cannot directly insert a fabricated entitlement event'
);
select extensions.throws_ok(
  $$ select public.apply_entitlement_update('21000000-0000-0000-0000-000000000003', 'SUBSCRIPTION_ACTIVE', 'revenuecat', 'app-user-1', now() + interval '1 year', 'purchase_verified', 'evt-forged-1', '{}'::jsonb) $$,
  '42501', 'permission denied for function apply_entitlement_update',
  'apply_entitlement_update() has no execute grant to authenticated at all -- only the service-role-invoked webhook path may call it'
);

reset role;
set local role postgres;
select extensions.throws_ok(
  $$ update public.entitlement_events set metadata = '{"tampered":true}'::jsonb where id = (select id from public.entitlement_events where event_type = 'trial_started' limit 1) $$,
  '42501', 'Entitlement events are immutable',
  'no ordinary update to an entitlement event is ever permitted, even as postgres'
);

-- Webhook idempotency: apply_entitlement_update(), called as postgres
-- (simulating the service-role webhook path), never applies the same
-- provider_event_id twice.
select public.apply_entitlement_update('21000000-0000-0000-0000-000000000003', 'SUBSCRIPTION_ACTIVE', 'revenuecat', 'rc-app-user-3', now() + interval '1 year', 'purchase_verified', 'evt-real-1', '{"product":"lilica_annual"}'::jsonb);
select public.apply_entitlement_update('21000000-0000-0000-0000-000000000003', 'SUBSCRIPTION_ACTIVE', 'revenuecat', 'rc-app-user-3', now() + interval '1 year', 'purchase_verified', 'evt-real-1', '{"product":"lilica_annual"}'::jsonb);
select extensions.is(
  (select count(*)::int from public.entitlement_events where provider_event_id = 'evt-real-1'),
  1,
  'apply_entitlement_update() is idempotent -- a redelivered webhook event never duplicates'
);
select extensions.is(
  (select status from public.entitlements where user_id = '21000000-0000-0000-0000-000000000003'),
  'SUBSCRIPTION_ACTIVE',
  'apply_entitlement_update() correctly transitions a real account to SUBSCRIPTION_ACTIVE'
);

-- ---------------------------------------------------------------------
-- 11. Account deletion: entitlement cleanup, commercial_owner_id
--     detachment, and surviving-data correctness.
-- ---------------------------------------------------------------------

-- Give Outsider Space a second active organiser first -- otherwise
-- delete_my_account() correctly (and separately, per Phase 18B's own
-- exhaustively-tested sole-organiser safeguard) refuses to delete a sole
-- organiser's account, which is not what THIS test is exercising. A
-- direct fixture insert is used here rather than the real invite/accept
-- RPC flow, since the thing under test is entitlement/commercial_owner_id
-- cleanup on deletion, not invitation lifecycle.
reset role;
set local role postgres;
insert into public.care_space_memberships (care_space_id, user_id, role, relationship_type, bootstrap_id)
values (
  (select id from public.care_spaces where bootstrap_id = '21100000-0000-4000-a000-000000000004' and bootstrap_owner_id = '21000000-0000-0000-0000-000000000004'),
  '21000000-0000-0000-0000-000000000002', 'organiser', 'Someone else', gen_random_uuid()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000004', true);
select extensions.lives_ok(
  $$ select public.delete_my_account() $$,
  'account deletion succeeds once the account is no longer a sole organiser -- unrelated to and never gated by entitlement state'
);

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.entitlements where user_id = '21000000-0000-0000-0000-000000000004'),
  0,
  'the deleted account''s own entitlement row is removed'
);
select extensions.is(
  (select commercial_owner_id from public.care_spaces where bootstrap_owner_id is null and bootstrap_id = '21100000-0000-4000-a000-000000000004'),
  null,
  'commercial_owner_id is detached (set null) on a care space whose owner deleted their account, exactly like bootstrap_owner_id'
);

select * from extensions.finish();
rollback;
