-- LILICA -- MULTI-PERSON CARE CIRCLE INVITATION SCOPE (`\downloads\perm.txt`,
-- 15 September 2026). Proves the real reported bug is fixed
-- (davidmaruta2@gmail.com supports Maggie AND Ben; a contributor
-- invited once could only see Maggie) without weakening per-person
-- security anywhere: access to Maggie never implies access to Ben,
-- an unselected supported person (Jackie) never gains any access, and
-- an organiser can never include a care space through this new path
-- that invite_member() itself would refuse them directly.
begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(25);

insert into auth.users (id, email)
values
  ('65000000-0000-0000-0000-000000000001', 'mp-david@example.test'),
  ('65000000-0000-0000-0000-000000000002', 'mp-sarah@example.test'),
  ('65000000-0000-0000-0000-000000000003', 'mp-unrelated@example.test'),
  ('65000000-0000-0000-0000-000000000004', 'mp-kate-organiser@example.test');

-- ---------------------------------------------------------------------
-- Setup: David supports Maggie, Ben AND Jackie. A separate organiser
-- ("Kate's organiser") supports a fourth space, Kate, and gives David
-- only CONTRIBUTOR access to it -- David is a real member of Kate's
-- space, but not its organiser (item 11's authority test).
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"65100000-0000-4000-a000-000000000001","display_name":"Maggie","relationship_type":"Mum","relationship_label":null},
  {"draft_id":"65100000-0000-4000-a000-000000000002","display_name":"Ben","relationship_type":"Dad","relationship_label":null},
  {"draft_id":"65100000-0000-4000-a000-000000000003","display_name":"Jackie","relationship_type":"Other relative","relationship_label":"Aunt"}
]'::jsonb);

reset role;
set local role postgres;
select sp.care_space_id as maggie_id from public.supported_people sp
  join public.care_spaces cs on cs.id = sp.care_space_id
  where cs.bootstrap_owner_id = '65000000-0000-0000-0000-000000000001' and sp.display_name = 'Maggie' \gset
select sp.care_space_id as ben_id from public.supported_people sp
  join public.care_spaces cs on cs.id = sp.care_space_id
  where cs.bootstrap_owner_id = '65000000-0000-0000-0000-000000000001' and sp.display_name = 'Ben' \gset
select sp.care_space_id as jackie_id from public.supported_people sp
  join public.care_spaces cs on cs.id = sp.care_space_id
  where cs.bootstrap_owner_id = '65000000-0000-0000-0000-000000000001' and sp.display_name = 'Jackie' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000004', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"65200000-0000-4000-a000-000000000001","display_name":"Kate","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
select sp.care_space_id as kate_id from public.supported_people sp
  join public.care_spaces cs on cs.id = sp.care_space_id
  where cs.bootstrap_owner_id = '65000000-0000-0000-0000-000000000004' and sp.display_name = 'Kate' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000004', true);
select public.invite_member(:'kate_id'::uuid, 'mp-david@example.test', 'contributor', array['general'], 'Other relative', 'Friend', '65300000-0000-4000-a000-000000000001');

reset role;
set local role postgres;
select id as kate_invitation_id from public.care_space_invitations
  where care_space_id = :'kate_id'::uuid and invitee_email = 'mp-david@example.test' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000001', true);
select public.accept_invitation(:'kate_invitation_id'::uuid, gen_random_uuid());
-- David is now a real CONTRIBUTOR of Kate's space -- a genuine member,
-- but not its organiser.

-- ---------------------------------------------------------------------
-- (1)-(9): the real reported scenario. David selects Maggie + Ben for
-- Sarah, Contributor, [general, health].
-- ---------------------------------------------------------------------
select public.invite_member_group(
  array[:'maggie_id'::uuid, :'ben_id'::uuid],
  'mp-sarah@example.test', 'contributor', array['general', 'health'],
  'Other relative', 'Friend', '65400000-0000-4000-a000-000000000001'
);

reset role;
set local role postgres;
select ig.id as group_id, ig.invite_code as group_code
  from public.care_space_invitation_groups ig
  where ig.invitee_email = 'mp-sarah@example.test' \gset

-- (1)/(2): grouped invitation created correctly -- two children, both
-- tagged with the same group id, both scoped to Maggie/Ben respectively.
select extensions.results_eq(
  $$select care_space_id from public.care_space_invitations where invitation_group_id = '$$ || :'group_id' || $$'::uuid order by care_space_id$$,
  $$values ('$$ || (select least(:'maggie_id', :'ben_id')) || $$'::uuid), ('$$ || (select greatest(:'maggie_id', :'ben_id')) || $$'::uuid)$$,
  '(1)/(2) invite_member_group() created exactly two child invitations, one per selected care space'
);

-- (3): one invitee identity.
select extensions.results_eq(
  $$select count(distinct invitee_email)::int from public.care_space_invitations where invitation_group_id = '$$ || :'group_id' || $$'::uuid$$,
  $$values (1)$$,
  '(3) exactly one invitee identity across the whole group'
);

-- (4): one coherent user-facing code.
select extensions.ok(:'group_code' ~ '^[A-Z2-9]{8}$', '(4) the group has exactly one human-friendly, correctly-shaped invite code');

-- (5)/(6): preview lists exactly Maggie + Ben, no protected data.
set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000003', true); -- unrelated account may preview
select extensions.results_eq(
  $$select result_status, care_space_names, role, granted_domains from public.resolve_invitation_by_code('$$ || :'group_code' || $$')$$,
  -- Names come back alphabetically (Ben before Maggie) -- a deliberate,
  -- deterministic choice: sibling child invitations from the same
  -- invite_member_group() call can share the exact same
  -- statement_timestamp(), so an insertion-order/created_at ordering
  -- would be non-deterministic; alphabetical is stable and sensible.
  $$values ('ok'::text, array['Ben','Maggie'], 'contributor', array['general','health'])$$,
  '(5) resolve_invitation_by_code() previews exactly Maggie + Ben, correct role and domains'
);
select extensions.set_eq(
  $$select parameter_name from information_schema.parameters
    where specific_schema = 'public' and specific_name like 'resolve_invitation_by_code%' and parameter_mode = 'OUT'$$,
  array['result_status', 'id', 'group_id', 'care_space_name', 'care_space_names', 'invited_by_display_name', 'role', 'granted_domains'],
  '(6) the preview exposes no protected field -- never invitee_email or care_space_id'
);

-- (7)/(8)/(9): accept creates membership to Maggie AND Ben, exact role,
-- exact domain grants on BOTH independently.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000002', true);
select public.accept_invitation_group(:'group_id'::uuid, gen_random_uuid());

select extensions.results_eq(
  $$select role from public.care_space_memberships where care_space_id = '$$ || :'maggie_id' || $$'::uuid and user_id = '65000000-0000-0000-0000-000000000002'$$,
  $$values ('contributor')$$,
  '(7)/(8) Sarah has a Maggie membership with exactly the offered role'
);
select extensions.results_eq(
  $$select role from public.care_space_memberships where care_space_id = '$$ || :'ben_id' || $$'::uuid and user_id = '65000000-0000-0000-0000-000000000002'$$,
  $$values ('contributor')$$,
  '(7)/(8) Sarah ALSO has a Ben membership with exactly the offered role'
);
select extensions.results_eq(
  $$select domain from public.care_space_domain_grants g join public.care_space_memberships m on m.id = g.membership_id where m.care_space_id = '$$ || :'maggie_id' || $$'::uuid and m.user_id = '65000000-0000-0000-0000-000000000002' order by domain$$,
  $$values ('general'), ('health')$$,
  '(9) Sarah''s Maggie membership has exactly the offered domain grants'
);
select extensions.results_eq(
  $$select domain from public.care_space_domain_grants g join public.care_space_memberships m on m.id = g.membership_id where m.care_space_id = '$$ || :'ben_id' || $$'::uuid and m.user_id = '65000000-0000-0000-0000-000000000002' order by domain$$,
  $$values ('general'), ('health')$$,
  '(9) Sarah''s Ben membership ALSO has exactly the offered domain grants -- independently proven, not inferred from Maggie''s'
);

-- ---------------------------------------------------------------------
-- David's own organiser-side view (list_care_space_invitations) must
-- expose the GROUP's own invite_code, never a child's internal one --
-- sharing the wrong code would silently resolve to a single-person
-- preview missing everyone else in the group.
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000001', true);
select extensions.results_eq(
  $$select invite_code, group_id, group_participant_names from public.list_care_space_invitations('$$ || :'maggie_id' || $$'::uuid) where invitee_email = 'mp-sarah@example.test'$$,
  $$values ('$$ || :'group_code' || $$'::text, '$$ || :'group_id' || $$'::uuid, array['Ben','Maggie'])$$,
  'David''s own Care Circle view shows the GROUP''s own code and every participant name, never a child''s internal code'
);

-- ---------------------------------------------------------------------
-- (10): negative selection -- Jackie was never selected, so Sarah has
-- absolutely no access to her.
-- ---------------------------------------------------------------------
select extensions.results_eq(
  $$select count(*)::int from public.care_space_memberships where care_space_id = '$$ || :'jackie_id' || $$'::uuid and user_id = '65000000-0000-0000-0000-000000000002'$$,
  $$values (0)$$,
  '(10) Sarah has NO membership to Jackie -- selecting Maggie+Ben never implies Jackie'
);
select extensions.results_eq(
  $$select count(*)::int from public.care_space_invitations where care_space_id = '$$ || :'jackie_id' || $$'::uuid and invitee_email = 'mp-sarah@example.test'$$,
  $$values (0)$$,
  '(10) no invitation of any kind was ever created for Jackie'
);

-- ---------------------------------------------------------------------
-- (11): authority test -- David is only a CONTRIBUTOR of Kate's space.
-- Trying to include Kate in a group invitation must fail the ENTIRE
-- call (nothing partial left behind), never silently drop just Kate.
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000001', true);
select extensions.throws_like(
  $$select public.invite_member_group(
      array['$$ || :'maggie_id' || $$'::uuid, '$$ || :'kate_id' || $$'::uuid],
      'mp-unrelated@example.test', 'contributor', array['general'],
      'Other relative', 'Friend', gen_random_uuid()
    )$$,
  'Only an active organiser can invite members',
  '(11) David cannot include Kate -- he is only a contributor there, not its organiser -- and the WHOLE call is rejected server-side'
);
select extensions.results_eq(
  $$select count(*)::int from public.care_space_invitations where care_space_id = '$$ || :'maggie_id' || $$'::uuid and invitee_email = 'mp-unrelated@example.test'$$,
  $$values (0)$$,
  '(11) the rejected call left NOTHING behind -- not even an invitation for the care space (Maggie) David DOES organise'
);

-- ---------------------------------------------------------------------
-- (12): wrong authenticated invitee cannot accept a group either --
-- accept_invitation_group() defers entirely to the same identity check
-- accept_invitation() itself already enforces per child.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000001', true);
select public.invite_member_group(
  array[:'maggie_id'::uuid, :'ben_id'::uuid],
  'mp-decline-target@example.test', 'viewer', array['general'],
  'Other relative', 'Friend', '65500000-0000-4000-a000-000000000001'
);
reset role;
set local role postgres;
insert into auth.users (id, email) values ('65000000-0000-0000-0000-000000000005', 'mp-decline-target@example.test');
select ig.id as decline_group_id from public.care_space_invitation_groups ig
  where ig.invitee_email = 'mp-decline-target@example.test' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000003', true);
select extensions.throws_like(
  $$select public.accept_invitation_group('$$ || :'decline_group_id' || $$'::uuid, gen_random_uuid())$$,
  'Invitation not found',
  '(12) an unrelated authenticated account cannot accept a grouped invitation that was not sent to them'
);

-- ---------------------------------------------------------------------
-- (13): decline creates zero memberships for ANY selected person.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000005', true);
select public.decline_invitation_group(:'decline_group_id'::uuid);

select extensions.results_eq(
  $$select count(*)::int from public.care_space_memberships where user_id = '65000000-0000-0000-0000-000000000005'$$,
  $$values (0)$$,
  '(13) declining a grouped invitation creates zero memberships for EITHER selected person'
);
-- care_space_invitation_groups deliberately has ZERO RLS policies (same
-- design as invitation_code_attempts) -- no authenticated role, even the
-- genuine invitee, can read it directly. Read as postgres purely for
-- this test's own verification, exactly like invitation_code_rate_
-- limit.test.sql's assertion (H).
reset role;
set local role postgres;
select extensions.results_eq(
  $$select status from public.care_space_invitation_groups where id = '$$ || :'decline_group_id' || $$'::uuid$$,
  $$values ('declined')$$,
  '(13) the group itself resolves coherently to declined'
);

-- ---------------------------------------------------------------------
-- (14): revoke prevents all grouped acceptance.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000001', true);
select public.invite_member_group(
  array[:'maggie_id'::uuid, :'ben_id'::uuid],
  'mp-revoke-target@example.test', 'viewer', array['general'],
  'Other relative', 'Friend', '65600000-0000-4000-a000-000000000001'
);
reset role;
set local role postgres;
insert into auth.users (id, email) values ('65000000-0000-0000-0000-000000000006', 'mp-revoke-target@example.test');
select ig.id as revoke_group_id from public.care_space_invitation_groups ig
  where ig.invitee_email = 'mp-revoke-target@example.test' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000001', true);
select public.revoke_invitation_group(:'revoke_group_id'::uuid);

select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000006', true);
select extensions.throws_like(
  $$select public.accept_invitation_group('$$ || :'revoke_group_id' || $$'::uuid, gen_random_uuid())$$,
  'This invitation is no longer open',
  '(14) a revoked group can never be accepted, for either selected person'
);

-- ---------------------------------------------------------------------
-- (15): expiry prevents all grouped acceptance/resolution.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000001', true);
select public.invite_member_group(
  array[:'maggie_id'::uuid, :'ben_id'::uuid],
  'mp-expiry-target@example.test', 'viewer', array['general'],
  'Other relative', 'Friend', '65700000-0000-4000-a000-000000000001'
);
reset role;
set local role postgres;
insert into auth.users (id, email) values ('65000000-0000-0000-0000-000000000007', 'mp-expiry-target@example.test');
select ig.id as expiry_group_id, ig.invite_code as expiry_group_code from public.care_space_invitation_groups ig
  where ig.invitee_email = 'mp-expiry-target@example.test' \gset

update public.care_space_invitations
set expires_at = now() - interval '1 day'
where invitation_group_id = :'expiry_group_id'::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000007', true);
select extensions.results_eq(
  $$select result_status from public.resolve_invitation_by_code('$$ || :'expiry_group_code' || $$')$$,
  $$values ('inactive'::text)$$,
  '(15) an expired group''s code resolves as inactive, coherently -- not "pending" while its children are already expired'
);
select extensions.throws_like(
  $$select public.accept_invitation_group('$$ || :'expiry_group_id' || $$'::uuid, gen_random_uuid())$$,
  'This invitation is no longer open',
  '(15) an expired group can never be accepted'
);

-- ---------------------------------------------------------------------
-- (16): duplicate acceptance is safe -- a second call fails cleanly,
-- never double-grants or errors ambiguously.
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000002', true);
select extensions.throws_like(
  $$select public.accept_invitation_group('$$ || :'group_id' || $$'::uuid, gen_random_uuid())$$,
  'This invitation is no longer open',
  '(16) accepting the SAME group a second time fails safely -- no duplicate membership row, no ambiguous error'
);
select extensions.results_eq(
  $$select count(*)::int from public.care_space_memberships where care_space_id = '$$ || :'maggie_id' || $$'::uuid and user_id = '65000000-0000-0000-0000-000000000002'$$,
  $$values (1)$$,
  '(16) still exactly ONE Maggie membership for Sarah -- the duplicate attempt created nothing extra'
);

-- ---------------------------------------------------------------------
-- (17): existing active Maggie membership + a NEW invite covering
-- Maggie+Ben creates ONLY Ben -- no duplicate Maggie membership, no
-- silent broadening, matching brief sections 34/35/36 exactly. Sarah
-- (already active on Maggie from above) is invited again, this time
-- selecting Maggie AND Ben.
-- ---------------------------------------------------------------------
reset role;
set local role postgres;
select count(*) as sarah_maggie_memberships_before from public.care_space_memberships
  where care_space_id = :'maggie_id'::uuid and user_id = '65000000-0000-0000-0000-000000000002' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000001', true);
select outcome, care_space_id from public.invite_member_group(
  array[:'maggie_id'::uuid, :'ben_id'::uuid],
  'mp-sarah@example.test', 'contributor', array['general', 'health'],
  'Other relative', 'Friend', '65800000-0000-4000-a000-000000000001'
) order by care_space_id;

select extensions.results_eq(
  $$select outcome from public.invite_member_group(
      array['$$ || :'maggie_id' || $$'::uuid],
      'mp-sarah@example.test', 'contributor', array['general'],
      'Other relative', 'Friend', gen_random_uuid()
    )$$,
  $$values ('already_has_access'::text)$$,
  '(17) re-selecting Maggie for someone who already has active access reports it truthfully instead of creating a duplicate invitation'
);
select extensions.results_eq(
  $$select count(*)::int from public.care_space_memberships where care_space_id = '$$ || :'maggie_id' || $$'::uuid and user_id = '65000000-0000-0000-0000-000000000002'$$,
  $$values (1)$$,
  '(17) still exactly one Maggie membership for Sarah -- no duplicate was ever created'
);

-- ---------------------------------------------------------------------
-- (18): existing single-person legacy invitation still works
-- completely unchanged (invitation_code.test.sql/invitation_code_rate_
-- limit.test.sql already prove this exhaustively; this is the
-- multi-person-specific proof that a legacy code's preview correctly
-- reports group_id as null and a single-element care_space_names, so
-- the client can distinguish the two paths).
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000001', true);
select public.invite_member(:'jackie_id'::uuid, 'mp-legacy@example.test', 'viewer', array['general'], 'Other relative', 'Friend', '65900000-0000-4000-a000-000000000001');

reset role;
set local role postgres;
select invite_code as legacy_code from public.care_space_invitations
  where care_space_id = :'jackie_id'::uuid and invitee_email = 'mp-legacy@example.test' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '65000000-0000-0000-0000-000000000003', true);
select extensions.results_eq(
  $$select result_status, group_id, care_space_names from public.resolve_invitation_by_code('$$ || :'legacy_code' || $$')$$,
  $$values ('ok'::text, null::uuid, array['Jackie'])$$,
  '(18) a legacy single-person invitation''s code still resolves exactly as before -- null group_id, one-element care_space_names, completely unchanged behaviour'
);

select extensions.finish();
rollback;
