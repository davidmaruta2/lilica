begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(22);

insert into auth.users (id, email)
values
  ('30000000-0000-0000-0000-000000000001', 'dcs-david@example.test'),
  ('30000000-0000-0000-0000-000000000002', 'dcs-marion@example.test'),
  ('30000000-0000-0000-0000-000000000003', 'dcs-viewer@example.test'),
  ('30000000-0000-0000-0000-000000000004', 'dcs-outsider@example.test');

-- ---------------------------------------------------------------------
-- Setup: David bootstraps Beauty (the target) and, separately, Jackie
-- Home (the cross-space isolation control). Marion is a second organiser
-- of Beauty; a viewer is also invited to prove their access is revoked
-- too. Outsider bootstraps their own unrelated space.
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"30100000-0000-4000-a000-000000000001","display_name":"Beauty","relationship_type":"Mum","relationship_label":null},
  {"draft_id":"30100000-0000-4000-a000-000000000002","display_name":"Jackie Home","relationship_type":"Other relative","relationship_label":"Aunt"}
]'::jsonb);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000004', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"30100000-0000-4000-a000-000000000004","display_name":"Outsider Space","relationship_type":"Myself","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
insert into public.profiles (id, display_name) values
  ('30000000-0000-0000-0000-000000000001', 'David'),
  ('30000000-0000-0000-0000-000000000002', 'Marion'),
  ('30000000-0000-0000-0000-000000000003', 'Viewer')
on conflict (id) do update set display_name = excluded.display_name;

-- Resolved ONCE, as postgres (bypassing RLS), and reused as a literal
-- value in every later statement regardless of which role/session-claim
-- is active -- a plain SELECT against supported_people/care_spaces under
-- a NON-member's own role (e.g. the outsider below) would be silently
-- filtered to zero rows by RLS, resolving to NULL rather than a real id;
-- passing that NULL into delete_care_space() would wrongly hit its own
-- idempotent "already gone" no-op path instead of exercising the real
-- permission check this test needs to prove. Scoped by THIS test's own
-- bootstrap_owner_id, not a bare display_name match -- against a shared,
-- persistent database (unlike a freshly reset local one) a display name
-- like "Beauty" is not guaranteed unique across every other account's own
-- historical data.
select sp.care_space_id as beauty_id
from public.supported_people sp
join public.care_spaces cs on cs.id = sp.care_space_id
where cs.bootstrap_owner_id = '30000000-0000-0000-0000-000000000001' and sp.display_name = 'Beauty' \gset
select sp.care_space_id as jackie_id
from public.supported_people sp
join public.care_spaces cs on cs.id = sp.care_space_id
where cs.bootstrap_owner_id = '30000000-0000-0000-0000-000000000001' and sp.display_name = 'Jackie Home' \gset
select cs.id as outsider_id
from public.care_spaces cs
where cs.bootstrap_owner_id = '30000000-0000-0000-0000-000000000004' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select public.invite_member(
  :'beauty_id'::uuid,
  'dcs-marion@example.test', 'contributor', array['general'], 'Other relative', 'Aunt', '30700000-0000-4000-a000-000000000002'
);
select public.invite_member(
  :'beauty_id'::uuid,
  'dcs-viewer@example.test', 'viewer', array['general'], 'Other relative', 'Friend', '30700000-0000-4000-a000-000000000003'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), '30800000-0000-4000-a000-000000000002');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), '30800000-0000-4000-a000-000000000003');

-- David promotes Marion to organiser too, so the "any active organiser,
-- not only the sole one" claim can be proven directly.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select public.change_member_role(
  (select id from public.care_space_memberships where user_id = '30000000-0000-0000-0000-000000000002'),
  'organiser', '{}'
);

-- Real data inside Beauty's space: two records (one with a due date, so
-- an occurrence is materialised), an attachment, and a link between
-- them -- so deletion is proven to remove genuine cross-table data, not
-- just the top-level row.
select public.apply_record_mutation(
  '30200000-0000-4000-a000-000000000001', '30300000-0000-4000-a000-000000000001',
  :'beauty_id'::uuid,
  'import', 0,
  '{"local_record_id":"task-1","record_type":"task","record_data":{"title":"Collect prescription","dueDate":"2026-10-01"}}'::jsonb
);
select public.apply_record_mutation(
  '30200000-0000-4000-a000-000000000002', '30300000-0000-4000-a000-000000000002',
  :'beauty_id'::uuid,
  'import', 0,
  '{"local_record_id":"doc-1","record_type":"document","record_data":{"title":"Blue Badge"}}'::jsonb
);
select public.upsert_record_attachment(
  '30400000-0000-4000-a000-000000000001', '30300000-0000-4000-a000-000000000002',
  :'beauty_id'::uuid,
  'file', 'blue-badge.pdf', 'application/pdf', 102400,
  :'beauty_id'::uuid::text || '/30300000-0000-4000-a000-000000000002/badge.pdf'
);
select public.create_record_link(
  :'beauty_id'::uuid,
  '30300000-0000-4000-a000-000000000001', '30300000-0000-4000-a000-000000000002', 'related_to'
);

-- ---------------------------------------------------------------------
-- 1-2. Permission: a non-member, and a member who is not an organiser,
-- cannot delete the care space.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000004', true);
select extensions.throws_ok(
  format('select public.delete_care_space(%L::uuid)', :'beauty_id'),
  '42501',
  'Only an active organiser of this care space can remove it',
  'a genuinely unrelated account cannot delete Beauty'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select extensions.throws_ok(
  format('select public.delete_care_space(%L::uuid)', :'beauty_id'),
  '42501',
  'Only an active organiser of this care space can remove it',
  'a viewer (not an organiser) cannot delete Beauty'
);

-- ---------------------------------------------------------------------
-- 3. Phase 20D tightening: a second, non-sole organiser (Marion) can NO
-- LONGER delete the care space alone -- with multiple active organisers,
-- permanent deletion requires every one of them to agree. David requests
-- it (his own approval counts automatically); a viewer cannot approve;
-- Marion's approval completes consensus and performs the actual deletion
-- via the same, unmodified, already-tested cascade machinery.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
select extensions.throws_ok(
  format('select public.delete_care_space(%L::uuid)', :'beauty_id'),
  '42501',
  'Because this care space has more than one organiser, all organisers must agree before it can be permanently removed -- use request_care_space_deletion() instead',
  'a second, non-sole organiser cannot delete the care space alone'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select public.request_care_space_deletion(:'beauty_id'::uuid, 'care_no_longer_required') as delete_request_id \gset

select extensions.ok(:'delete_request_id' is not null, 'David''s deletion request was created (multiple active organisers exist)');
select extensions.is(
  (select organiser_count from public.get_care_space_deletion_status(:'beauty_id'::uuid)),
  2,
  'the request correctly counts 2 active organisers'
);
select extensions.is(
  (select approved_count from public.get_care_space_deletion_status(:'beauty_id'::uuid)),
  1,
  'the requesting organiser''s own approval already counts (David)'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select extensions.throws_ok(
  format('select public.approve_care_space_deletion(%L::uuid)', :'delete_request_id'),
  '42501',
  'Only an active organiser of this care space can approve its removal',
  'a viewer cannot approve a deletion request'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
select extensions.is(
  (select public.approve_care_space_deletion(:'delete_request_id'::uuid)),
  true,
  'Marion''s approval completes consensus and performs the actual deletion'
);

-- ---------------------------------------------------------------------
-- 4. Full cascade: every table genuinely emptied, not just care_spaces.
-- ---------------------------------------------------------------------

reset role;
set local role postgres;
select extensions.is((select count(*)::int from public.supported_people where care_space_id = :'beauty_id'::uuid), 0, 'the supported_people row is gone');
select extensions.is((select count(*)::int from public.care_spaces where id = :'beauty_id'::uuid), 0, 'the care_spaces row itself is gone');
select extensions.is((select count(*)::int from public.records where id in ('30300000-0000-4000-a000-000000000001','30300000-0000-4000-a000-000000000002')), 0, 'both records are gone');
select extensions.is((select count(*)::int from public.record_attachments where id = '30400000-0000-4000-a000-000000000001'), 0, 'the attachment is gone');
select extensions.is((select count(*)::int from public.record_links where source_record_id = '30300000-0000-4000-a000-000000000001'), 0, 'the record link is gone');
select extensions.is((select count(*)::int from public.occurrences where record_id in ('30300000-0000-4000-a000-000000000001','30300000-0000-4000-a000-000000000002')), 0, 'occurrences for those records are gone');

-- ---------------------------------------------------------------------
-- 5. Revoked access: David, Marion and the viewer each have zero
-- remaining active memberships anywhere -- Beauty was their only one.
-- ---------------------------------------------------------------------

select extensions.is(
  (select count(*)::int from public.care_space_memberships
    where user_id = '30000000-0000-0000-0000-000000000003' and membership_status = 'active'),
  0,
  'the former viewer has no remaining active membership anywhere -- Beauty was their only one'
);
select extensions.is(
  (select count(*)::int from public.care_space_memberships
    where user_id = '30000000-0000-0000-0000-000000000002' and membership_status = 'active'),
  0,
  'the deleting organiser (Marion) has no remaining active membership on the now-deleted space'
);

-- ---------------------------------------------------------------------
-- 6. Idempotent retry: calling delete_care_space again for the same,
-- already-deleted care space id is a safe no-op, not an error.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
select extensions.lives_ok(
  $$ select public.delete_care_space('00000000-0000-0000-0000-000000000000'::uuid) $$,
  'deleting an already-nonexistent care space id is a safe no-op'
);

-- ---------------------------------------------------------------------
-- 7. Cross-space isolation: David's OTHER care space (Jackie Home) is
-- completely unaffected by Beauty's deletion.
-- ---------------------------------------------------------------------

reset role;
set local role postgres;
select extensions.is((select count(*)::int from public.supported_people where care_space_id = :'jackie_id'::uuid), 1, 'Jackie Home (David''s other care space) still exists');
select extensions.is(
  (select count(*)::int from public.care_space_memberships where care_space_id = :'jackie_id'::uuid and user_id = '30000000-0000-0000-0000-000000000001' and membership_status = 'active'),
  1,
  'David remains an active organiser of Jackie Home, untouched by Beauty''s deletion'
);

-- ---------------------------------------------------------------------
-- 8. The genuinely unrelated Outsider Space is also completely
-- unaffected.
-- ---------------------------------------------------------------------

select extensions.is((select count(*)::int from public.care_spaces where id = :'outsider_id'::uuid), 1, 'Outsider Space still exists, completely untouched');

-- ---------------------------------------------------------------------
-- 9. No public/anon execute grant exists -- only `authenticated`, and the
-- function itself enforces the real organiser check (proven in 1-2).
-- ---------------------------------------------------------------------

select extensions.ok(
  not has_function_privilege('anon', 'public.delete_care_space(uuid)', 'execute'),
  'anon has no execute grant on delete_care_space'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.delete_care_space(uuid)', 'execute'),
  'authenticated has execute grant on delete_care_space (the function itself enforces the real organiser check)'
);

select * from extensions.finish();
rollback;
