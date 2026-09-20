-- rename_supported_person() (20 September 2026, direct product-owner
-- request): same organiser-only authority and idempotent-retry shape as
-- archive_care_space()/restore_care_space() -- see
-- care_space_lifecycle.test.sql for the pattern this mirrors.
begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(9);

insert into auth.users (id, email)
values
  ('89000000-0000-0000-0000-000000000001', 'rsp-david@example.test'),
  ('89000000-0000-0000-0000-000000000002', 'rsp-contributor@example.test'),
  ('89000000-0000-0000-0000-000000000003', 'rsp-viewer@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '89000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"89100000-0000-4000-a000-000000000001","display_name":"Maggie","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
select sp.care_space_id as maggie_id
from public.supported_people sp
join public.care_spaces cs on cs.id = sp.care_space_id
where cs.bootstrap_owner_id = '89000000-0000-0000-0000-000000000001' and sp.display_name = 'Maggie' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '89000000-0000-0000-0000-000000000001', true);
select public.invite_member(:'maggie_id'::uuid, 'rsp-contributor@example.test', 'contributor', array['general'], 'Other relative', 'Friend', '89700000-0000-4000-a000-000000000002');
select public.invite_member(:'maggie_id'::uuid, 'rsp-viewer@example.test', 'viewer', array['general'], 'Other relative', 'Friend', '89700000-0000-4000-a000-000000000003');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '89000000-0000-0000-0000-000000000002', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), '89800000-0000-4000-a000-000000000002');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '89000000-0000-0000-0000-000000000003', true);
select public.accept_invitation((select id from public.list_my_invitations() limit 1), '89800000-0000-4000-a000-000000000003');

-- A contributor cannot rename.
select extensions.throws_ok(
  format('select public.rename_supported_person(%L::uuid, ''Margaret'')', :'maggie_id'),
  '42501',
  'Only an active organiser of this care space can rename it',
  'a contributor cannot rename the supported person'
);

-- Nor a viewer.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '89000000-0000-0000-0000-000000000003', true);
select extensions.throws_ok(
  format('select public.rename_supported_person(%L::uuid, ''Margaret'')', :'maggie_id'),
  '42501',
  'Only an active organiser of this care space can rename it',
  'a viewer cannot rename the supported person'
);

-- An empty/whitespace-only name is rejected, same length rule as initial
-- setup (supported_people_display_name_length).
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '89000000-0000-0000-0000-000000000001', true);
select extensions.throws_ok(
  format('select public.rename_supported_person(%L::uuid, ''   '')', :'maggie_id'),
  '22023',
  'Name must be between 1 and 80 characters',
  'a whitespace-only name is rejected'
);

-- The organiser can rename.
select extensions.lives_ok(
  format('select public.rename_supported_person(%L::uuid, ''  Margaret  '')', :'maggie_id'),
  'an active organiser (David) can rename Maggie to Margaret'
);

reset role;
set local role postgres;
select extensions.is(
  (select display_name from public.supported_people where care_space_id = :'maggie_id'::uuid),
  'Margaret',
  'the stored name is trimmed and updated'
);

select extensions.is(
  (select count(*)::int from public.care_space_activity where care_space_id = :'maggie_id'::uuid and event_type = 'supported_person_renamed'),
  1,
  'a supported_person_renamed activity event was logged'
);

select extensions.is(
  (select metadata ->> 'title' from public.care_space_activity where care_space_id = :'maggie_id'::uuid and event_type = 'supported_person_renamed'),
  'Margaret',
  'the activity event metadata carries the new (trimmed) name'
);

-- A second organiser can also rename -- not restricted to the original
-- bootstrapping organiser. David (already an organiser) promotes the
-- contributor -- promote_to_organiser must be called by an EXISTING
-- organiser, never by the person being promoted.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '89000000-0000-0000-0000-000000000001', true);
select public.promote_to_organiser(:'maggie_id'::uuid, (select id from public.care_space_memberships where user_id = '89000000-0000-0000-0000-000000000002'));

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '89000000-0000-0000-0000-000000000002', true);
select extensions.lives_ok(
  format('select public.rename_supported_person(%L::uuid, ''Maggie'')', :'maggie_id'),
  'a second, newly-promoted organiser can also rename the supported person'
);

reset role;
set local role postgres;
select extensions.is(
  (select display_name from public.supported_people where care_space_id = :'maggie_id'::uuid),
  'Maggie',
  'the rename by the second organiser took effect'
);

select * from extensions.finish();
rollback;
