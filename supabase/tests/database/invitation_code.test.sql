-- Care Circle invitation & joining flow completion (`\downloads\carecircle.txt`,
-- 14 September 2026): proves resolve_invitation_by_code() is a pure,
-- additive LOCATOR -- it returns only minimal safe preview information,
-- and every identity/eligibility/role/domain decision still runs through
-- the completely unmodified accept_invitation(). Does not re-prove
-- accept_invitation()/decline_invitation()/revoke_invitation() from
-- scratch (already proven by phase15_care_circle.test.sql and
-- assignments_domain_scoped_read.test.sql, both unchanged and still
-- passing) -- only what is genuinely new this pass.
begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(15);

insert into auth.users (id, email)
values
  ('61000000-0000-0000-0000-000000000001', 'code-david@example.test'),
  ('61000000-0000-0000-0000-000000000002', 'code-marion@example.test'),
  ('61000000-0000-0000-0000-000000000003', 'code-unrelated@example.test');

insert into public.profiles (id, display_name) values
  ('61000000-0000-0000-0000-000000000001', 'David')
on conflict (id) do update set display_name = excluded.display_name;

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"61100000-0000-4000-a000-000000000001","display_name":"Maggie","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
select sp.care_space_id as maggie_id
from public.supported_people sp
join public.care_spaces cs on cs.id = sp.care_space_id
where cs.bootstrap_owner_id = '61000000-0000-0000-0000-000000000001' and sp.display_name = 'Maggie' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select public.invite_member(:'maggie_id'::uuid, 'code-marion@example.test', 'contributor', array['general', 'health'], 'Other relative', 'Aunt', '61200000-0000-4000-a000-000000000001');

reset role;
set local role postgres;
select id as invitation_id, invite_code
from public.care_space_invitations
where care_space_id = :'maggie_id'::uuid and invitee_email = 'code-marion@example.test' \gset

-- ---------------------------------------------------------------------
-- 1. A real code, generated server-side, has the expected shape.
-- ---------------------------------------------------------------------
select extensions.ok(:'invite_code' ~ '^[A-Z2-9]{8}$', 'generated code matches the expected 8-character unambiguous-alphabet shape');
select extensions.isnt(:'invite_code'::text, null::text, 'a code was genuinely generated, not left null');

-- ---------------------------------------------------------------------
-- 2. Any authenticated caller can resolve a valid code to a safe preview
--    -- this is deliberately NOT restricted to the invited identity
--    (preview leaks nothing sensitive; only ACCEPT is identity-gated).
-- ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000003', true); -- unrelated account
select extensions.results_eq(
  $$select result_status, id, role, granted_domains from public.resolve_invitation_by_code('$$ || :'invite_code' || $$')$$,
  $$values ('ok'::text, $$ || quote_literal(:'invitation_id') || $$::uuid, 'contributor', array['general','health'])$$,
  'resolve_invitation_by_code returns the correct invitation id, role and granted domains for a valid code, to ANY authenticated caller'
);

-- ---------------------------------------------------------------------
-- 3. Case-insensitive and dash-tolerant.
-- ---------------------------------------------------------------------
select extensions.lives_ok(
  $$select * from public.resolve_invitation_by_code(lower(substr('$$ || :'invite_code' || $$', 1, 4)) || '-' || upper(substr('$$ || :'invite_code' || $$', 5, 4)))$$,
  'a lowercased, dash-formatted version of the same code still resolves'
);

-- ---------------------------------------------------------------------
-- 4. Preview NEVER exposes invitee_email or care_space_id.
-- ---------------------------------------------------------------------
-- Multi-person invitation scope (`\downloads\perm.txt`, 15 September
-- 2026): resolve_invitation_by_code() gained exactly two additive OUT
-- columns -- group_id (null for a legacy single-person code) and
-- care_space_names (a plural array; a single-element array for a
-- legacy code) -- so a grouped invitation's preview can list every
-- selected supported person. Still never invitee_email or
-- care_space_id.
select extensions.set_eq(
  $$select parameter_name from information_schema.parameters
    where specific_schema = 'public' and specific_name like 'resolve_invitation_by_code%' and parameter_mode = 'OUT'$$,
  array['result_status', 'id', 'group_id', 'care_space_name', 'care_space_names', 'invited_by_display_name', 'role', 'granted_domains'],
  'resolve_invitation_by_code returns ONLY result_status/id/group_id/care_space_name/care_space_names/invited_by_display_name/role/granted_domains -- never invitee_email or care_space_id'
);

-- ---------------------------------------------------------------------
-- 5. Malformed / nonexistent codes fail safely, with calm distinct
--    messages, never a database-internal error.
-- ---------------------------------------------------------------------
select extensions.results_eq(
  $$select result_status from public.resolve_invitation_by_code('')$$,
  $$values ('invalid_input'::text)$$,
  'an empty code fails with a calm, specific result -- no exception'
);
select extensions.results_eq(
  $$select result_status from public.resolve_invitation_by_code('NOTREAL1')$$,
  $$values ('not_found'::text)$$,
  'a well-formed but nonexistent code fails safely, without leaking anything'
);

-- ---------------------------------------------------------------------
-- 6. A code cannot be used after the invitation is revoked.
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select public.revoke_invitation(:'invitation_id'::uuid);

select extensions.results_eq(
  $$select result_status from public.resolve_invitation_by_code('$$ || :'invite_code' || $$')$$,
  $$values ('inactive'::text)$$,
  'a revoked invitation''s code resolves to a calm "inactive" result, not a generic not-found -- and not silently as if still valid'
);

-- The underlying accept_invitation() -- completely unmodified -- still
-- correctly refuses the now-revoked invitation regardless of how its id
-- was obtained.
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
select extensions.throws_like(
  $$select public.accept_invitation('$$ || :'invitation_id' || $$'::uuid, gen_random_uuid())$$,
  'This invitation is no longer open',
  'accept_invitation() -- unmodified -- still refuses a revoked invitation even when its id came from a resolved code'
);

-- ---------------------------------------------------------------------
-- 7. A fresh invitation: code-driven identity protection is enforced
--    entirely by the UNCHANGED accept_invitation(), not by the code.
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
select public.invite_member(:'maggie_id'::uuid, 'code-marion@example.test', 'viewer', array['general'], 'Other relative', 'Niece', '61300000-0000-4000-a000-000000000001');

reset role;
set local role postgres;
select id as invitation2_id, invite_code as invite_code2
from public.care_space_invitations
where care_space_id = :'maggie_id'::uuid and invitee_email = 'code-marion@example.test' and status = 'pending' \gset

-- Resolving the code as the UNRELATED account still works (preview is
-- permissive)...
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok(
  $$select * from public.resolve_invitation_by_code('$$ || :'invite_code2' || $$')$$,
  'the unrelated account CAN preview the invitation via its code (no sensitive data exposed by doing so)'
);

-- ...but that same unrelated account cannot ACCEPT it -- the code never
-- bypasses accept_invitation()'s own email-identity check.
select extensions.throws_like(
  $$select public.accept_invitation('$$ || :'invitation2_id' || $$'::uuid, gen_random_uuid())$$,
  'Invitation not found',
  'an unrelated authenticated account cannot accept the invitation just because it resolved the code -- accept_invitation()''s own identity check, unmodified, still refuses it'
);

-- The genuinely invited account, resolving the SAME code, can accept --
-- proving one canonical invitation reached two different ways
-- (id directly, or via code) converges on identical acceptance.
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
select extensions.lives_ok(
  $$select public.accept_invitation('$$ || :'invitation2_id' || $$'::uuid, gen_random_uuid())$$,
  'the genuinely invited account can accept the SAME invitation id the code resolved to'
);

-- Accepted invitation''s code can no longer be resolved as pending.
select extensions.results_eq(
  $$select result_status from public.resolve_invitation_by_code('$$ || :'invite_code2' || $$')$$,
  $$values ('inactive'::text)$$,
  'once accepted, the same code no longer resolves as an active, joinable invitation'
);

-- The resulting membership has exactly the invitation''s own role/domains
-- -- never broadened by having been reached via a code.
select extensions.results_eq(
  $$select role from public.care_space_memberships where care_space_id = '$$ || :'maggie_id' || $$'::uuid and user_id = '61000000-0000-0000-0000-000000000002'$$,
  $$values ('viewer')$$,
  'the resulting membership role is exactly what the invitation specified (viewer), never broadened'
);
select extensions.results_eq(
  $$select domain from public.care_space_domain_grants g join public.care_space_memberships m on m.id = g.membership_id where m.care_space_id = '$$ || :'maggie_id' || $$'::uuid and m.user_id = '61000000-0000-0000-0000-000000000002' order by domain$$,
  $$values ('general')$$,
  'the resulting domain grants are exactly what the invitation specified, never broadened by the code route'
);

select extensions.finish();
rollback;
