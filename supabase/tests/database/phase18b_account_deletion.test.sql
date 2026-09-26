begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(36);

insert into auth.users (id, email)
values
  ('b8000000-0000-0000-0000-000000000001', 'p18b-david@example.test'),
  ('b8000000-0000-0000-0000-000000000002', 'p18b-sarah@example.test'),
  ('b8000000-0000-0000-0000-000000000003', 'p18b-lonely@example.test');

-- ---------------------------------------------------------------------
-- Setup: Beauty, organised solely by David to start with.
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b8000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"b8100000-0000-4000-a000-000000000001","display_name":"Beauty","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
insert into public.profiles (id, display_name) values
  ('b8000000-0000-0000-0000-000000000001', 'David M')
on conflict (id) do update set display_name = excluded.display_name;

-- A record, an occurrence, a linked document, an attachment and an
-- assignment, all created/attributed to David -- the exact shared-data
-- shape the brief's own two-account scenario describes.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b8000000-0000-0000-0000-000000000001', true);
select public.apply_record_mutation(
  'b8200000-0000-4000-a000-000000000001', 'b8300000-0000-4000-a000-000000000001',
  (select id from public.care_spaces where bootstrap_owner_id = 'b8000000-0000-0000-0000-000000000001'),
  'import', 0,
  '{"local_record_id":"appt-1","record_type":"appointment","record_data":{"title":"Orthopaedic appointment"}}'::jsonb
);
select public.apply_record_mutation(
  'b8200000-0000-4000-a000-000000000002', 'b8300000-0000-4000-a000-000000000002',
  (select id from public.care_spaces where bootstrap_owner_id = 'b8000000-0000-0000-0000-000000000001'),
  'import', 0,
  '{"local_record_id":"doc-1","record_type":"document","record_data":{"title":"Hospital letter"}}'::jsonb
);
select public.create_record_link(
  (select id from public.care_spaces where bootstrap_owner_id = 'b8000000-0000-0000-0000-000000000001'),
  (select id from public.records where local_record_id = 'doc-1'),
  (select id from public.records where local_record_id = 'appt-1'),
  'related_to'
);
select public.upsert_record_attachment(
  'b8400000-0000-4000-a000-000000000001',
  (select id from public.records where local_record_id = 'doc-1'),
  (select id from public.care_spaces where bootstrap_owner_id = 'b8000000-0000-0000-0000-000000000001'),
  'file', 'Hospital letter.pdf', 'application/pdf', 12345,
  (select id from public.care_spaces where bootstrap_owner_id = 'b8000000-0000-0000-0000-000000000001') || '/doc-1/file.pdf'
);
select public.create_assignment(
  'b8500000-0000-4000-a000-000000000001', 'b8600000-0000-4000-a000-000000000001',
  (select id from public.care_spaces where bootstrap_owner_id = 'b8000000-0000-0000-0000-000000000001'),
  'record', (select id from public.records where local_record_id = 'appt-1'),
  'membership', (select id from public.care_space_memberships where user_id = 'b8000000-0000-0000-0000-000000000001')
);

-- ---------------------------------------------------------------------
-- Unauthenticated / cross-account rejection.
-- ---------------------------------------------------------------------

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
-- Same as every other RPC in this schema (e.g. leave_care_space): anon
-- has no grant at all, so this is refused at the permission layer before
-- the function's own internal auth.uid() check ever runs.
select extensions.throws_ok(
  $$ select public.delete_my_account() $$,
  '42501', 'permission denied for function delete_my_account',
  'unauthenticated deletion is denied'
);

-- ---------------------------------------------------------------------
-- Sole-organiser deletion is now ALLOWED (direct product-owner decision,
-- 26 September 2026 -- previously this was a hard block). Proven with a
-- separate, isolated account/care space so the rest of this file's
-- David/Sarah/Beauty scenario below is completely unaffected.
-- ---------------------------------------------------------------------

insert into auth.users (id, email)
values ('b8000000-0000-0000-0000-000000000004', 'p18b-solo@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b8000000-0000-0000-0000-000000000004', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"b8100000-0000-4000-a000-000000000002","display_name":"Solo Person","relationship_type":"Friend","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
insert into public.profiles (id, display_name) values
  ('b8000000-0000-0000-0000-000000000004', 'Solo Organiser')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b8000000-0000-0000-0000-000000000004', true);
select public.apply_record_mutation(
  'b8200000-0000-4000-a000-000000000003', 'b8300000-0000-4000-a000-000000000003',
  (select id from public.care_spaces where bootstrap_owner_id = 'b8000000-0000-0000-0000-000000000004'),
  'import', 0,
  '{"local_record_id":"solo-appt-1","record_type":"appointment","record_data":{"title":"Solo appointment"}}'::jsonb
);

-- Real-device bug, 26 September 2026: deleting an account that had ever
-- created a multi-person invitation group failed outright with
-- "violates foreign key constraint" on auth.users --
-- care_space_invitation_groups.invited_by_user_id referenced auth.users
-- directly with ON DELETE RESTRICT, and delete_my_account() never
-- detached it. Reproduced here exactly: the solo organiser creates a
-- group invitation before deleting their own account.
select public.invite_member_group(
  array[(select id from public.care_spaces where bootstrap_owner_id = 'b8000000-0000-0000-0000-000000000004')],
  'p18b-solo-invitee@example.test', 'contributor', array['general'], 'Other relative', 'Friend',
  'b8900000-0000-4000-a000-000000000001'
);

select extensions.lives_ok(
  $$ select public.delete_my_account() $$,
  'a sole active organiser can now delete their own account directly (no longer blocked), even having created an invitation group'
);

reset role;
set local role postgres;

select extensions.is(
  (select count(*) from auth.users where id = 'b8000000-0000-0000-0000-000000000004'),
  0::bigint,
  'the solo organiser''s auth identity is actually gone'
);
select extensions.is(
  (select membership_status from public.care_space_memberships where former_display_name = 'Solo Organiser'),
  'former',
  'the solo organiser''s own membership is detached and marked former, never deleted'
);
select extensions.is(
  (select bootstrap_owner_id from public.care_spaces where id = (select care_space_id from public.care_space_memberships where former_display_name = 'Solo Organiser')),
  null,
  'the care space''s bootstrap_owner_id is detached'
);
select extensions.is(
  (select commercial_owner_id from public.care_spaces where id = (select care_space_id from public.care_space_memberships where former_display_name = 'Solo Organiser')),
  null,
  'the care space''s commercial_owner_id is detached -- this is the mechanism behind "closes the care circle"'
);
select extensions.is(
  (select public.care_space_has_active_entitlement((select care_space_id from public.care_space_memberships where former_display_name = 'Solo Organiser'))),
  false,
  'the now-unowned care space is gated from further mutation for anyone -- the care circle is commercially closed'
);
select extensions.is(
  (select count(*) from public.records where local_record_id = 'solo-appt-1'),
  1::bigint,
  'the record the solo organiser created still survives, readable'
);
select extensions.is(
  (select invited_by_user_id from public.care_space_invitation_groups where operation_id = 'b8900000-0000-4000-a000-000000000001'),
  null,
  'the invitation group''s invited_by_user_id is detached, not left dangling -- this is what actually made deletion succeed'
);
select extensions.is(
  (select status from public.care_space_invitation_groups where operation_id = 'b8900000-0000-4000-a000-000000000001'),
  'pending',
  'the invitation group itself, and its pending child invitation, are otherwise untouched'
);

-- A lonely account with no care spaces at all may always delete freely.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b8000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok(
  $$ select public.delete_my_account() $$,
  'an account with no care spaces can delete freely'
);
reset role;
set local role postgres;
select extensions.is(
  (select count(*) from auth.users where id = 'b8000000-0000-0000-0000-000000000003'),
  0::bigint,
  'the lonely account''s auth identity is actually gone'
);

-- ---------------------------------------------------------------------
-- Second organiser unblocks deletion.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b8000000-0000-0000-0000-000000000001', true);
select public.invite_member(
  (select id from public.care_spaces where bootstrap_owner_id = 'b8000000-0000-0000-0000-000000000001'),
  'p18b-sarah@example.test', 'viewer', array['general'], 'Other relative', 'Aunt', 'b8700000-0000-4000-a000-000000000001'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b8000000-0000-0000-0000-000000000002', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), 'b8800000-0000-4000-a000-000000000001');
reset role;
set local role postgres;
insert into public.profiles (id, display_name) values
  ('b8000000-0000-0000-0000-000000000002', 'Sarah')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b8000000-0000-0000-0000-000000000001', true);
select public.change_member_role(
  (select id from public.care_space_memberships where user_id = 'b8000000-0000-0000-0000-000000000002'),
  'organiser', '{}'
);

-- David has a second pending invitation still outstanding (never
-- accepted) -- proves selective revocation below.
select public.invite_member(
  (select id from public.care_spaces where bootstrap_owner_id = 'b8000000-0000-0000-0000-000000000001'),
  'p18b-pending@example.test', 'viewer', array['general'], 'Other relative', 'Uncle', 'b8700000-0000-4000-a000-000000000002'
);

select extensions.lives_ok(
  $$ select public.delete_my_account() $$,
  'David can delete his account now that Sarah is also an active organiser'
);

reset role;
set local role postgres;

select extensions.is(
  (select count(*) from auth.users where id = 'b8000000-0000-0000-0000-000000000001'),
  0::bigint,
  'David''s auth identity is actually gone'
);
select extensions.is(
  (select count(*) from public.profiles where id = 'b8000000-0000-0000-0000-000000000001'),
  0::bigint,
  'David''s profile row cascaded away with the auth identity'
);
select extensions.is(
  (select membership_status from public.care_space_memberships where former_display_name = 'David M'),
  'former',
  'David''s membership is marked former, never deleted'
);
select extensions.is(
  (select user_id from public.care_space_memberships where former_display_name = 'David M'),
  null,
  'David''s membership is detached from the live (now-deleted) identity'
);
select extensions.is(
  (select id from public.care_space_memberships where former_display_name = 'David M') is not null,
  true,
  'David''s membership id itself was never deleted or regenerated'
);
select extensions.is(
  (select status from public.care_space_invitations where invitee_email = 'p18b-pending@example.test'),
  'revoked',
  'David''s own still-pending sent invitation is revoked on deletion'
);
select extensions.is(
  (select status from public.care_space_invitations where invitee_email = 'p18b-sarah@example.test'),
  'accepted',
  'Sarah''s already-accepted invitation is untouched'
);

-- Shared data survives, still attributed to David's now-former membership.
-- (care_spaces.bootstrap_owner_id was deliberately nulled by the deletion
-- itself, above -- looked up via David's now-former membership instead.)
select extensions.is(
  (select count(*) from public.records
   where care_space_id = (select care_space_id from public.care_space_memberships where former_display_name = 'David M')
     and local_record_id in ('appt-1', 'doc-1')),
  2::bigint,
  'both shared records survive account deletion'
);
select extensions.is(
  (select created_by_membership_id from public.records where local_record_id = 'appt-1'),
  (select id from public.care_space_memberships where former_display_name = 'David M'),
  'the appointment''s created_by_membership_id still points at David''s (now former) membership'
);
select extensions.is((select count(*) from public.record_links), 1::bigint, 'the document/appointment link survives');
select extensions.is((select count(*) from public.record_attachments where deleted_at is null), 1::bigint, 'the attachment survives');
select extensions.is(
  (select count(*) from public.assignments where membership_id = (select id from public.care_space_memberships where former_display_name = 'David M')),
  1::bigint,
  'the assignment is never silently reassigned -- it still points at David''s former membership'
);
select extensions.is(
  (select display_name_snapshot from public.assignments limit 1),
  'David M',
  'the assignment''s own historical snapshot is untouched'
);

-- Former membership cannot access anything, exactly like a revoked one --
-- enforced by the SAME existing "membership_status = 'active'" check
-- every read/write policy already uses, no new RLS logic.
-- (There is no live identity left to authenticate as David, so this is
-- proven from Sarah's side: her own read access is unaffected, and no
-- function grants a former membership renewed access.)
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b8000000-0000-0000-0000-000000000002', true);
select extensions.is((select count(*) from public.records where local_record_id in ('appt-1', 'doc-1')), 2::bigint, 'Sarah, the remaining organiser, still sees both records');
select extensions.is((select count(*) from public.record_links), 1::bigint, 'Sarah still sees the link');
select extensions.is((select count(*) from public.record_attachments where deleted_at is null), 1::bigint, 'Sarah still sees the attachment');

-- resolve_membership_identities(): Sarah can resolve David's former
-- membership to a truthful historical snapshot.
select extensions.is(
  (select display_name from public.resolve_membership_identities(
    array[(select id from public.care_space_memberships where former_display_name = 'David M')]
  )),
  'David M',
  'resolve_membership_identities returns the historical snapshot for a former member'
);
select extensions.is(
  (select is_former from public.resolve_membership_identities(
    array[(select id from public.care_space_memberships where former_display_name = 'David M')]
  )),
  true,
  'resolve_membership_identities flags a former membership as former'
);
select extensions.is(
  (select is_former from public.resolve_membership_identities(
    array[(select id from public.care_space_memberships where user_id = 'b8000000-0000-0000-0000-000000000002')]
  )),
  false,
  'resolve_membership_identities flags a live membership as not former'
);

-- Idempotency: retrying delete_my_account() would need David's own JWT,
-- which can no longer authenticate (his identity is gone) -- proven
-- instead by calling it directly as postgres impersonating his old sub,
-- confirming it is a safe no-op rather than an error.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b8000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$ select public.delete_my_account() $$,
  'retrying delete_my_account() for an already-deleted identity is a safe no-op'
);
reset role;
set local role postgres;
select extensions.is(
  (select count(*) from public.care_space_memberships where former_display_name = 'David M'),
  1::bigint,
  'the retry did not duplicate or corrupt the former membership'
);

-- The trigger refuses reattaching a detached membership to a live
-- identity, and refuses reassigning a still-live membership to someone
-- else -- both directly, independent of delete_my_account().
select extensions.throws_ok(
  $$ update public.care_space_memberships set user_id = 'b8000000-0000-0000-0000-000000000002'
     where former_display_name = 'David M' $$,
  '42501', 'A detached membership cannot be reattached to a live identity',
  'a detached membership can never be reattached to a live identity'
);
select extensions.throws_ok(
  $$ update public.care_space_memberships set user_id = 'b8000000-0000-0000-0000-000000000001'
     where user_id = 'b8000000-0000-0000-0000-000000000002' $$,
  '42501', 'Membership ownership identifiers are immutable',
  'a live membership can never be reassigned to a different user'
);

select * from extensions.finish();
rollback;
