begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(31);

select extensions.has_table('public', 'care_space_invitations', 'invitations table exists');
select extensions.has_table('public', 'care_space_domain_grants', 'domain grants table exists');
select extensions.is((select relrowsecurity from pg_class where oid = 'public.care_space_invitations'::regclass), true, 'invitations use RLS');
select extensions.is((select relrowsecurity from pg_class where oid = 'public.care_space_domain_grants'::regclass), true, 'domain grants use RLS');

insert into auth.users (id, email)
values
  ('e0000000-0000-0000-0000-000000000001', 'circle-organiser@example.test'),
  ('e0000000-0000-0000-0000-000000000002', 'circle-contributor@example.test'),
  ('e0000000-0000-0000-0000-000000000003', 'circle-viewer@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"e7000000-0000-4000-a000-000000000001","display_name":"Jackie","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
insert into public.profiles (id, display_name) values
  ('e0000000-0000-0000-0000-000000000001', 'Organiser Olu'),
  ('e0000000-0000-0000-0000-000000000002', 'Contributor Cara'),
  ('e0000000-0000-0000-0000-000000000003', 'Viewer Vic')
on conflict (id) do update set display_name = excluded.display_name;

-- Scenario A/B: invite, and the invitee has zero access while pending.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$ select public.invite_member(
       (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
       'circle-contributor@example.test', 'contributor',
       array['general', 'home'], 'Other relative', 'Cousin',
       'e7100000-0000-4000-a000-000000000001'
     ) $$,
  'organiser can invite a contributor with explicit domain grants'
);
select extensions.is((select count(*) from public.care_space_invitations), 1::bigint, 'one pending invitation exists');
select extensions.is((select status from public.care_space_invitations), 'pending', 'invitation starts pending');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000002', true);
select extensions.is(
  (select public.can_access_care_space_records(
    (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
    'general', 'read'
  )),
  false,
  'a pending invitee has zero access before accepting'
);
select extensions.is((select count(*) from public.list_my_invitations()), 1::bigint, 'invitee sees exactly their own pending invitation');

-- Scenario B continued: accept creates a real membership and exactly the
-- granted domains -- default-deny for anything not explicitly granted.
select extensions.lives_ok(
  $$ select public.accept_invitation(
       (select id from public.list_my_invitations() limit 1),
       'e7200000-0000-4000-a000-000000000002'
     ) $$,
  'invitee can accept their own invitation'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select extensions.is((select status from public.care_space_invitations), 'accepted', 'invitation is now accepted');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000002', true);
select extensions.is(
  (select public.can_access_care_space_records(
    (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
    'general', 'write'
  )),
  true,
  'contributor has write access to a granted domain'
);
select extensions.is(
  (select public.can_access_care_space_records(
    (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
    'financial', 'read'
  )),
  false,
  'contributor has zero access to a domain never granted -- default-deny holds'
);

-- Scenario D: assignment without visibility must fail safely, even though
-- the organiser assigning it has full access themselves.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$ select public.apply_record_mutation(
       'e7300000-0000-4000-a000-000000000003',
       'e7400000-0000-4000-a000-000000000003',
       (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
       'import', 0,
       '{"local_record_id":"bill-1","record_type":"bill","record_data":{"title":"Electric"}}'::jsonb
     ) $$,
  'organiser can create a financial-domain record'
);
select extensions.throws_ok(
  $$ select public.apply_record_mutation(
       'e7300000-0000-4000-a000-000000000004',
       'e7400000-0000-4000-a000-000000000003',
       (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
       'update', 1,
       ('{"local_record_id":"bill-1","record_type":"bill","record_data":{"title":"Electric","assignedMembershipId":"' ||
        (select id from public.care_space_memberships where user_id = 'e0000000-0000-0000-0000-000000000002') ||
        '"}}')::jsonb
     ) $$,
  '42501',
  'Assignee does not have access to this record',
  'assigning a financial-domain record to a member without financial access is rejected'
);

-- Scenario C: assigning within a domain the assignee CAN see succeeds.
select extensions.lives_ok(
  $$ select public.apply_record_mutation(
       'e7300000-0000-4000-a000-000000000005',
       'e7400000-0000-4000-a000-000000000003',
       (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
       'update', 1,
       ('{"local_record_id":"bill-1","record_type":"bill","record_data":{"title":"Electric","assignedMembershipId":"' ||
        (select id from public.care_space_memberships where user_id = 'e0000000-0000-0000-0000-000000000001') ||
        '"}}')::jsonb
     ) $$,
  'assigning to a member who does have the required domain access succeeds'
);

-- Scenario J: a viewer can read a granted domain but never write to it.
select extensions.lives_ok(
  $$ select public.invite_member(
       (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
       'circle-viewer@example.test', 'viewer',
       array['general'], 'Other relative', 'Neighbour',
       'e7500000-0000-4000-a000-000000000006'
     ) $$,
  'organiser can invite a viewer'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000003', true);
select public.accept_invitation(
  (select id from public.list_my_invitations() limit 1),
  'e7600000-0000-4000-a000-000000000007'
);
select extensions.is(
  (select public.can_access_care_space_records(
    (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
    'general', 'read'
  )),
  true,
  'viewer can read a granted domain'
);
select extensions.throws_ok(
  $$ select public.apply_record_mutation(
       'e7700000-0000-4000-a000-000000000008',
       'e7800000-0000-4000-a000-000000000008',
       (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
       'import', 0,
       '{"local_record_id":"viewer-write-1","record_type":"task","record_data":{"title":"Should be blocked"}}'::jsonb
     ) $$,
  '42501',
  'Insufficient permission for this record domain',
  'a viewer cannot write even inside a domain they can read'
);

-- Scenario G: removal takes effect immediately, and history is retained.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$ select public.remove_member(
       (select id from public.care_space_memberships where user_id = 'e0000000-0000-0000-0000-000000000002')
     ) $$,
  'organiser can remove a member'
);
select extensions.is(
  (select record_data->>'assignedMembershipId' from public.records where local_record_id = 'bill-1'),
  (select id::text from public.care_space_memberships where user_id = 'e0000000-0000-0000-0000-000000000001'),
  'removal does not silently rewrite historical assignment attribution'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000002', true);
select extensions.is(
  (select public.can_access_care_space_records(
    (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
    'general', 'read'
  )),
  false,
  'a removed member has zero access immediately'
);

-- Scenario H: a replayed/offline mutation cannot recreate access for a
-- removed member by assigning work to them.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
select extensions.throws_ok(
  $$ select public.apply_record_mutation(
       'e7900000-0000-4000-a000-000000000009',
       'e7a00000-0000-4000-a000-000000000009',
       (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
       'import', 0,
       ('{"local_record_id":"stale-1","record_type":"appointment","record_data":{"title":"Stale","assignedMembershipId":"' ||
        (select id from public.care_space_memberships where user_id = 'e0000000-0000-0000-0000-000000000002') ||
        '"}}')::jsonb
     ) $$,
  '42501',
  'Assignee does not have access to this record',
  'a stale mutation cannot assign work to a removed member'
);

-- Sole-organiser safety.
select extensions.throws_ok(
  $$ select public.remove_member(
       (select id from public.care_space_memberships where user_id = 'e0000000-0000-0000-0000-000000000001')
     ) $$,
  '22023',
  'A care space must always keep at least one organiser',
  'the sole organiser cannot be removed'
);
select extensions.throws_ok(
  $$ select public.leave_care_space(
       (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001')
     ) $$,
  '22023',
  'Make someone else an organiser before you leave, so this care space is never left without one',
  'the sole organiser cannot leave without appointing another organiser first'
);

-- Scenario K: invitation terminal states.
select extensions.lives_ok(
  $$ select public.invite_member(
       (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
       'circle-contributor@example.test', 'contributor',
       array['general'], 'Other relative', 'Cousin',
       'e7b00000-0000-4000-a000-00000000000a'
     ) $$,
  'organiser can re-invite after removal'
);
select extensions.lives_ok(
  $$ select public.revoke_invitation(
       (select id from public.care_space_invitations where invitee_email = 'circle-contributor@example.test' and status = 'pending')
     ) $$,
  'organiser can revoke a pending invitation'
);
select extensions.is(
  (select status from public.care_space_invitations where invitee_email = 'circle-contributor@example.test' order by created_at desc limit 1),
  'revoked',
  'a revoked invitation is a terminal state'
);
select extensions.throws_ok(
  $$ select public.revoke_invitation(
       (select id from public.care_space_invitations where invitee_email = 'circle-contributor@example.test' order by created_at desc limit 1)
     ) $$,
  '22023',
  'This invitation is no longer open',
  'a revoked invitation cannot be revoked again'
);

-- Cross-space denial: an outsider cannot invite or list members.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000003', true);
select extensions.throws_ok(
  $$ select public.invite_member(
       (select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'),
       'someone-else@example.test', 'contributor',
       array['general'], 'Someone else', 'Friend',
       'e7c00000-0000-4000-a000-00000000000b'
     ) $$,
  '42501',
  'Only an active organiser can invite members',
  'a non-organiser member cannot invite anyone'
);
select extensions.is((select count(*) from public.list_care_space_members((select id from public.care_spaces where bootstrap_owner_id = 'e0000000-0000-0000-0000-000000000001'))), 2::bigint, 'member listing only ever shows active members');

select * from extensions.finish();
rollback;
