-- Phase 20D structural closure: multi-organiser deletion consent's
-- decline/cancel/duplicate-approval edge cases. The main request->approve
-- happy path (and the sole-organiser immediate-delete path) is already
-- covered inside delete_care_space.test.sql's own extended sequence --
-- this file covers what that one doesn't.
begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(10);

insert into auth.users (id, email)
values
  ('50000000-0000-0000-0000-000000000001', 'dc-david@example.test'),
  ('50000000-0000-0000-0000-000000000002', 'dc-marion@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"50100000-0000-4000-a000-000000000001","display_name":"Beauty","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
select sp.care_space_id as beauty_id
from public.supported_people sp
join public.care_spaces cs on cs.id = sp.care_space_id
where cs.bootstrap_owner_id = '50000000-0000-0000-0000-000000000001' and sp.display_name = 'Beauty' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select public.invite_member(:'beauty_id'::uuid, 'dc-marion@example.test', 'contributor', array['general'], 'Other relative', 'Aunt', '50700000-0000-4000-a000-000000000002');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), '50800000-0000-4000-a000-000000000002');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select public.change_member_role((select id from public.care_space_memberships where user_id = '50000000-0000-0000-0000-000000000002'), 'organiser', '{}');

-- ---------------------------------------------------------------------
-- CANCEL: the requesting organiser can cancel before it executes.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select public.request_care_space_deletion(:'beauty_id'::uuid, null) as request_1 \gset

-- Marion (a different organiser) cannot cancel David's own request.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
select extensions.throws_ok(
  format('select public.cancel_care_space_deletion(%L::uuid)', :'request_1'),
  '42501',
  'Only the organiser who requested this removal can cancel it',
  'a different organiser cannot cancel someone else''s request'
);

-- Duplicate approval by the SAME organiser who already implicitly
-- approved via requesting (David) is silently harmless, never an error,
-- never a double-count -- the unique constraint on
-- (request_id, membership_id) makes this a safe no-op.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select extensions.is(
  (select public.approve_care_space_deletion(:'request_1'::uuid)),
  false,
  'David re-approving his own already-counted approval is harmless and does not (yet) complete consensus -- Marion still has not approved'
);
select extensions.is(
  (select approved_count from public.get_care_space_deletion_status(:'beauty_id'::uuid)),
  1,
  'approved_count is still 1 -- the duplicate approval was not double-counted'
);

-- David cancels his own pending, not-yet-fully-approved request.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  format('select public.cancel_care_space_deletion(%L::uuid)', :'request_1'),
  'the requesting organiser (David) can cancel his own pending request'
);

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.care_space_deletion_requests where id = :'request_1'::uuid),
  0,
  'the cancelled request no longer exists'
);
select extensions.is(
  (select status from public.care_spaces where id = :'beauty_id'::uuid),
  'active',
  'cancellation prevents deletion -- the care space still exists and is untouched'
);

-- Approving a cancelled/nonexistent request fails cleanly.
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
select extensions.throws_ok(
  format('select public.approve_care_space_deletion(%L::uuid)', :'request_1'),
  '42501',
  'This removal request no longer exists',
  'approving an already-cancelled request fails cleanly'
);

-- ---------------------------------------------------------------------
-- DECLINE: any active organiser (not only the requester) can decline --
-- deletion does not proceed; a new request would be required.
-- ---------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select public.request_care_space_deletion(:'beauty_id'::uuid, 'care_no_longer_required') as request_3 \gset

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
select extensions.lives_ok(
  format('select public.decline_care_space_deletion(%L::uuid)', :'request_3'),
  'Marion (a different organiser than the requester) can decline the request'
);

reset role;
set local role postgres;
select extensions.is(
  (select count(*)::int from public.care_space_deletion_requests where id = :'request_3'::uuid),
  0,
  'the declined request no longer exists'
);
select extensions.is(
  (select status from public.care_spaces where id = :'beauty_id'::uuid),
  'active',
  'decline prevents deletion -- the care space still exists, untouched'
);

select * from extensions.finish();
rollback;
