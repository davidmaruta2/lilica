begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(45);

select extensions.has_table('public', 'record_links', 'record_links table exists');
select extensions.has_table('public', 'record_attachments', 'record_attachments table exists');
select extensions.is((select relrowsecurity from pg_class where oid = 'public.record_links'::regclass), true, 'record_links uses RLS');
select extensions.is((select relrowsecurity from pg_class where oid = 'public.record_attachments'::regclass), true, 'record_attachments uses RLS');
select extensions.ok(
  (select count(*) > 0 from storage.buckets where id = 'document-attachments' and public = false),
  'document-attachments bucket exists and is private'
);

insert into auth.users (id, email)
values
  ('f0000000-0000-0000-0000-000000000001', 'p16-organiser@example.test'),
  ('f0000000-0000-0000-0000-000000000002', 'p16-contributor-docs@example.test'),
  ('f0000000-0000-0000-0000-000000000003', 'p16-contributor-nodocs@example.test'),
  ('f0000000-0000-0000-0000-000000000004', 'p16-viewer-docs@example.test'),
  ('f0000000-0000-0000-0000-000000000005', 'p16-other-organiser@example.test'),
  ('f0000000-0000-0000-0000-000000000006', 'p16-pending-invitee@example.test');

-- Beauty's care space (organiser f...01).
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"f7000000-0000-4000-a000-000000000001","display_name":"Beauty","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

-- Jackie's SEPARATE care space (a wholly unrelated organiser f...05), used
-- only to prove cross-care-space rejection.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000005', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"f7000000-0000-4000-a000-000000000005","display_name":"Jackie","relationship_type":"Dad","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;

-- Two canonical records in Beauty's care space: a document and the
-- appointment it will be linked to.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);
select public.apply_record_mutation(
  'f7100000-0000-4000-a000-000000000001', 'f7200000-0000-4000-a000-000000000001',
  (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'),
  'import', 0,
  '{"local_record_id":"doc-1","record_type":"document","record_data":{"title":"Hospital appointment letter"}}'::jsonb
);
select public.apply_record_mutation(
  'f7100000-0000-4000-a000-000000000002', 'f7200000-0000-4000-a000-000000000002',
  (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'),
  'import', 0,
  '{"local_record_id":"appt-1","record_type":"appointment","record_data":{"title":"Orthopaedic appointment"}}'::jsonb
);

-- Invite a contributor WITH documents, a contributor WITHOUT documents, a
-- viewer WITH documents, and leave one invitation pending/unaccepted.
select public.invite_member(
  (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'),
  'p16-contributor-docs@example.test', 'contributor', array['documents'], 'Other relative', 'Aunt', 'f7300000-0000-4000-a000-000000000001'
);
select public.invite_member(
  (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'),
  'p16-contributor-nodocs@example.test', 'contributor', array['general'], 'Other relative', 'Uncle', 'f7300000-0000-4000-a000-000000000002'
);
select public.invite_member(
  (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'),
  'p16-viewer-docs@example.test', 'viewer', array['documents'], 'Other relative', 'Neighbour', 'f7300000-0000-4000-a000-000000000003'
);
select public.invite_member(
  (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'),
  'p16-pending-invitee@example.test', 'viewer', array['documents'], 'Other relative', 'Friend', 'f7300000-0000-4000-a000-000000000004'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000002', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), 'f7400000-0000-4000-a000-000000000002');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000003', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), 'f7400000-0000-4000-a000-000000000003');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000004', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), 'f7400000-0000-4000-a000-000000000004');

-- ---------------------------------------------------------------------
-- Section 13: explicit documents-domain permission coverage.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);
select extensions.is(
  (select public.can_access_care_space_records((select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'), 'documents', 'read')),
  true, 'organiser can access permitted document records'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000002', true);
select extensions.is(
  (select public.can_access_care_space_records((select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'), 'documents', 'read')),
  true, 'contributor WITH documents grant can read'
);
select extensions.is(
  (select public.can_access_care_space_records((select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'), 'documents', 'write')),
  true, 'contributor WITH documents grant can write'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000003', true);
select extensions.is(
  (select public.can_access_care_space_records((select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'), 'documents', 'read')),
  false, 'contributor WITHOUT documents grant cannot read'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000004', true);
select extensions.is(
  (select public.can_access_care_space_records((select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'), 'documents', 'read')),
  true, 'viewer with documents grant can read'
);
select extensions.is(
  (select public.can_access_care_space_records((select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'), 'documents', 'write')),
  false, 'viewer with documents grant cannot write'
);

-- A domain grant with can_read but can_write=false (a combination the
-- current invite/change-role RPCs never produce, since a domain grant is
-- always symmetric per role today, but the underlying primitive itself
-- must still be correct for any future UI that offers it independently).
reset role;
set local role postgres;
update public.care_space_domain_grants
set can_write = false
where membership_id = (select id from public.care_space_memberships where user_id = 'f0000000-0000-0000-0000-000000000002')
  and domain = 'documents';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000002', true);
select extensions.is(
  (select public.can_access_care_space_records((select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'), 'documents', 'read')),
  true, 'a read-only documents grant can still read'
);
select extensions.is(
  (select public.can_access_care_space_records((select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'), 'documents', 'write')),
  false, 'a read-only documents grant cannot write (contributor with read but without write cannot mutate)'
);

-- Restore full contributor write access for the remaining scenarios.
reset role;
set local role postgres;
update public.care_space_domain_grants
set can_write = true
where membership_id = (select id from public.care_space_memberships where user_id = 'f0000000-0000-0000-0000-000000000002')
  and domain = 'documents';

-- Pending invitee: zero access before accepting.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000006', true);
select extensions.is(
  (select public.can_access_care_space_records((select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'), 'documents', 'read')),
  false, 'pending invitee cannot read documents'
);

-- Cross-care-space member: no membership at all in Beauty's space.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000005', true);
select extensions.is(
  (select public.can_access_care_space_records((select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'), 'documents', 'read')),
  false, 'cross-care-space member cannot read documents'
);

-- Assignment does not grant documents access: assigning the document to
-- the no-documents contributor is rejected outright by the existing
-- Phase 15 assignee-visibility check, applied here to the documents
-- domain specifically (Phase 15's own tests only exercised general/
-- financial).
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);
select extensions.throws_ok(
  $$ select public.apply_record_mutation(
       'f7100000-0000-4000-a000-000000000003', 'f7200000-0000-4000-a000-000000000001',
       (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'),
       'update', 1,
       ('{"local_record_id":"doc-1","record_type":"document","record_data":{"title":"Hospital appointment letter","assignedMembershipId":"' ||
        (select id from public.care_space_memberships where user_id = 'f0000000-0000-0000-0000-000000000003') ||
        '"}}')::jsonb
     ) $$,
  '42501', 'Assignee does not have access to this record',
  'assignment does not grant documents access -- assigning to a member without the documents grant is rejected'
);

-- Revoked member: immediate zero access.
select public.remove_member((select id from public.care_space_memberships where user_id = 'f0000000-0000-0000-0000-000000000002'));
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000002', true);
select extensions.is(
  (select public.can_access_care_space_records((select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'), 'documents', 'read')),
  false, 'revoked member immediately cannot read documents'
);

-- ---------------------------------------------------------------------
-- record_links.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);

select extensions.throws_ok(
  $$ select public.create_record_link(
       (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'),
       'f7200000-0000-4000-a000-000000000001', 'f7200000-0000-4000-a000-000000000001', 'related_to'
     ) $$,
  '22023', 'A record cannot be linked to itself',
  'a record cannot be linked to itself'
);

select extensions.lives_ok(
  $$ select public.create_record_link(
       (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'),
       'f7200000-0000-4000-a000-000000000001', 'f7200000-0000-4000-a000-000000000002', 'related_to'
     ) $$,
  'organiser can link the document to the appointment'
);
select extensions.is((select count(*) from public.record_links where deleted_at is null), 1::bigint, 'exactly one link row exists');

select extensions.is(
  (select public.create_record_link(
     (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'),
     'f7200000-0000-4000-a000-000000000001', 'f7200000-0000-4000-a000-000000000002', 'related_to'
   )),
  (select id from public.record_links where deleted_at is null limit 1),
  'a retried create_record_link is idempotent -- returns the same link, not a duplicate'
);
select extensions.is((select count(*) from public.record_links where deleted_at is null), 1::bigint, 'still exactly one link row after the retry');

select extensions.is(
  (select other_record_title from public.list_record_links('f7200000-0000-4000-a000-000000000001') limit 1),
  'Orthopaedic appointment',
  'the document sees the appointment as an outgoing related_to link'
);
select extensions.is(
  (select direction from public.list_record_links('f7200000-0000-4000-a000-000000000001') limit 1),
  'outgoing', 'direction is outgoing from the document''s own point of view'
);
select extensions.is(
  (select other_record_title from public.list_record_links('f7200000-0000-4000-a000-000000000002') limit 1),
  'Hospital appointment letter',
  'the SAME stored relationship shows the document from the appointment''s side (bidirectional, one row)'
);
select extensions.is(
  (select direction from public.list_record_links('f7200000-0000-4000-a000-000000000002') limit 1),
  'incoming', 'direction is incoming from the appointment''s own point of view'
);

-- Cross-care-space link rejection: Jackie's organiser cannot link Beauty's
-- records, even by guessing their stable IDs.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000005', true);
select extensions.throws_ok(
  $$ select public.create_record_link(
       (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000005'),
       'f7200000-0000-4000-a000-000000000001', 'f7200000-0000-4000-a000-000000000002', 'related_to'
     ) $$,
  '42501', 'Source record not found in this care space',
  'cross-care-space link creation is rejected'
);

-- Restricted linked-record non-disclosure: the no-documents contributor
-- can read the appointment (granted 'general') but must never learn it is
-- linked to a document they cannot see.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000003', true);
select extensions.is(
  (select count(*) from public.list_record_links('f7200000-0000-4000-a000-000000000002')),
  0::bigint,
  'a member without documents access sees no link from the appointment, even though they can read the appointment itself'
);

-- Link deletion/tombstone.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);
select public.remove_record_link((select id from public.record_links where deleted_at is null limit 1));
select extensions.is((select count(*) from public.list_record_links('f7200000-0000-4000-a000-000000000001')), 0::bigint, 'a removed link no longer appears from either side');
select extensions.is((select count(*) from public.record_links where deleted_at is not null), 1::bigint, 'the link row is tombstoned, not deleted outright');

-- ---------------------------------------------------------------------
-- record_attachments.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$ select public.upsert_record_attachment(
       'f7500000-0000-4000-a000-000000000001', 'f7200000-0000-4000-a000-000000000001',
       (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'),
       'file', 'hospital-letter.pdf', 'application/pdf', 204800,
       (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001')::text || '/f7200000-0000-4000-a000-000000000001/f7500000-0000-4000-a000-000000000001-hospital-letter.pdf'
     ) $$,
  'organiser can persist attachment metadata for the document'
);
select extensions.is(
  (select upload_status from public.record_attachments where id = 'f7500000-0000-4000-a000-000000000001'),
  'pending', 'a fresh attachment starts pending, never marked uploaded before bytes are confirmed'
);

select extensions.lives_ok(
  $$ select public.upsert_record_attachment(
       'f7500000-0000-4000-a000-000000000001', 'f7200000-0000-4000-a000-000000000001',
       (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'),
       'file', 'hospital-letter.pdf', 'application/pdf', 204800,
       (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001')::text || '/f7200000-0000-4000-a000-000000000001/f7500000-0000-4000-a000-000000000001-hospital-letter.pdf'
     ) $$,
  'a retried upload with the same client-generated id converges, does not duplicate'
);
select extensions.is((select count(*) from public.record_attachments where record_id = 'f7200000-0000-4000-a000-000000000001'), 1::bigint, 'exactly one attachment row exists after the retry');

select public.mark_attachment_upload_status('f7500000-0000-4000-a000-000000000001', 'uploaded');
select extensions.is(
  (select upload_status from public.record_attachments where id = 'f7500000-0000-4000-a000-000000000001'),
  'uploaded', 'upload status transitions to uploaded only once explicitly confirmed'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000004', true);
select extensions.ok(
  (select count(*) from public.record_attachments where record_id = 'f7200000-0000-4000-a000-000000000001') = 1,
  'viewer with documents grant can read attachment metadata'
);
select extensions.throws_ok(
  $$ select public.upsert_record_attachment(
       'f7500000-0000-4000-a000-000000000002', 'f7200000-0000-4000-a000-000000000001',
       (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001'),
       'file', 'x.pdf', 'application/pdf', 1,
       'irrelevant-path'
     ) $$,
  '42501', 'Insufficient permission for this record domain',
  'a viewer cannot mutate attachment metadata even though they can read it'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000005', true);
select extensions.throws_ok(
  $$ select public.upsert_record_attachment(
       'f7500000-0000-4000-a000-000000000003', 'f7200000-0000-4000-a000-000000000001',
       (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000005'),
       'file', 'x.pdf', 'application/pdf', 1,
       'irrelevant-path'
     ) $$,
  '42501', 'Record not found in this care space',
  'a member of a different care space cannot attach a file to another space''s record'
);
select extensions.is(
  (select count(*) from public.record_attachments where record_id = 'f7200000-0000-4000-a000-000000000001'),
  0::bigint,
  'cross-care-space member cannot read Beauty''s attachment metadata either (RLS filters the row)'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);
select public.remove_record_attachment('f7500000-0000-4000-a000-000000000001');
select extensions.is(
  (select deleted_at is not null from public.record_attachments where id = 'f7500000-0000-4000-a000-000000000001'),
  true, 'removing an attachment tombstones it rather than deleting the row outright'
);

-- ---------------------------------------------------------------------
-- storage.objects RLS (row-level only -- no real file service running
-- under pgTAP; this proves the access boundary, not byte transfer).
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('document-attachments',
       (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001')::text
         || '/f7200000-0000-4000-a000-000000000001/f7500000-0000-4000-a000-000000000001-hospital-letter.pdf',
       auth.uid()) $$,
  'organiser can create the storage object row for a document they can write'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000003', true);
select extensions.throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('document-attachments',
       (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001')::text
         || '/f7200000-0000-4000-a000-000000000001/blocked.pdf',
       auth.uid()) $$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'a member without documents write access cannot upload into a document''s storage path'
);
select extensions.is(
  (select count(*) from storage.objects
   where bucket_id = 'document-attachments'
     and name like (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001')::text || '/%'),
  0::bigint,
  'a member without documents read access sees zero objects under that care space''s path'
);

-- Note: the DELETE storage policy is not exercised here -- Supabase's
-- local storage schema raises "Direct deletion from storage tables is
-- not allowed. Use the Storage API instead." (storage.protect_delete())
-- for ANY raw SQL delete against storage.objects, regardless of role,
-- before RLS is even evaluated. The policy exists in the migration for
-- when the real Storage API is used (which does not go through this
-- trigger); this is a known limitation of testing it via pgTAP, not a
-- gap in the policy itself. See docs/PHASE_16_ARCHITECTURE.md.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000004', true);
select extensions.is(
  (select count(*) from storage.objects
   where bucket_id = 'document-attachments'
     and name like (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001')::text || '/%'),
  1::bigint,
  'a viewer with documents read access can see the stored object row'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000005', true);
select extensions.throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('document-attachments',
       (select id from public.care_spaces where bootstrap_owner_id = 'f0000000-0000-0000-0000-000000000001')::text
         || '/f7200000-0000-4000-a000-000000000001/cross-space.pdf',
       auth.uid()) $$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'a member of a different care space cannot upload into another space''s document path'
);

select * from extensions.finish();
rollback;
