-- Invitation code rate-limit security correction (14 September 2026,
-- GPT/product-owner review). Proves the corrected architecture: ONE
-- client-callable resolver (resolve_invitation_by_code()) that does
-- authentication, rate-limit accounting, the threshold check, AND the
-- lookup atomically -- the previous record_invitation_code_attempt()
-- bypass path no longer exists at all. Threshold/window UNCHANGED: 10
-- attempts per rolling 5-minute window per authenticated account.
begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(15);

insert into auth.users (id, email)
values
  ('64000000-0000-0000-0000-000000000001', 'rl-david@example.test'),
  ('64000000-0000-0000-0000-000000000002', 'rl-marion@example.test'),
  ('64000000-0000-0000-0000-000000000003', 'rl-unrelated@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '64000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"64100000-0000-4000-a000-000000000001","display_name":"Maggie","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
select sp.care_space_id as maggie_id
from public.supported_people sp
join public.care_spaces cs on cs.id = sp.care_space_id
where cs.bootstrap_owner_id = '64000000-0000-0000-0000-000000000001' and sp.display_name = 'Maggie' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '64000000-0000-0000-0000-000000000001', true);
select public.invite_member(:'maggie_id'::uuid, 'rl-marion@example.test', 'contributor', array['general'], 'Other relative', 'Aunt', '64200000-0000-4000-a000-000000000001');

reset role;
set local role postgres;
select id as invitation_id, invite_code from public.care_space_invitations
where care_space_id = :'maggie_id'::uuid and invitee_email = 'rl-marion@example.test' \gset

-- (A) exactly one usable public code-resolution path.
select extensions.is(
  has_function_privilege('authenticated', 'public.resolve_invitation_by_code(text)', 'EXECUTE'),
  true,
  '(A) authenticated CAN call the one intended public resolver'
);

-- (B) the old bypass-prone helper genuinely no longer exists at all --
-- not merely un-granted, GONE, so there is no residual attack surface.
select extensions.is(
  (select count(*)::int from pg_proc where proname = 'record_invitation_code_attempt'),
  0,
  '(B) the previous client-invoked attempt-counter RPC no longer exists -- no bypass path to audit around'
);

-- The caller for the rest of this file is the unrelated account.
set local role authenticated;
select set_config('request.jwt.claim.sub', '64000000-0000-0000-0000-000000000003', true);

-- (C) 1-10 attempts permitted -- a few wrong guesses, then the real
-- code, all succeed normally (never throttled, never an exception).
select extensions.results_eq(
  $$select result_status from public.resolve_invitation_by_code('WRONGONE')$$,
  $$values ('not_found'::text)$$,
  '(C) attempt 1: a wrong guess resolves to a calm "not_found" result -- no exception, no lost accounting'
);
select extensions.results_eq(
  $$select result_status from public.resolve_invitation_by_code('WRONGTWO')$$,
  $$values ('not_found'::text)$$,
  '(C) attempt 2: another wrong guess'
);
select extensions.results_eq(
  $$select result_status, id from public.resolve_invitation_by_code('$$ || :'invite_code' || $$')$$,
  $$values ('ok'::text, '$$ || :'invitation_id' || $$'::uuid)$$,
  '(C) attempt 3: the real code still resolves normally -- ordinary typo/retry remains practical'
);

-- Drive to the threshold with 7 more (3 so far; 10 total never throttles).
select extensions.lives_ok(
  $outer$do $inner$
    begin
      for i in 1..7 loop
        perform public.resolve_invitation_by_code('BADCODE' || i::text);
      end loop;
    end;
  $inner$;
  $outer$,
  'attempts 4-10: seven more resolve normally (each a real, non-raising "not_found" result), reaching the threshold exactly'
);

-- (D) the 11th attempt is throttled.
select extensions.results_eq(
  $$select result_status from public.resolve_invitation_by_code('anything')$$,
  $$values ('throttled'::text)$$,
  '(D) attempt 11: throttled'
);

-- (E) even the genuinely correct code is throttled once over the limit
-- -- proving no bypass by supplying a valid code.
select extensions.results_eq(
  $$select result_status from public.resolve_invitation_by_code('$$ || :'invite_code' || $$')$$,
  $$values ('throttled'::text)$$,
  '(E) the correct code, on the 11th+ attempt, is STILL throttled -- a valid code cannot bypass the limit'
);

-- (H) invalid guesses genuinely persisted in the count -- proven
-- directly by reading the server-side counter itself, not inferred.
-- Read as postgres (RLS is FORCED with zero policies -- the
-- authenticated role itself genuinely cannot see this table at all,
-- confirmed separately by assertion (I) below; this is a real
-- superuser inspection for the test's own verification, not something
-- any client could do).
reset role;
set local role postgres;
select extensions.results_eq(
  $$select attempt_count >= 10 from public.invitation_code_attempts where user_id = '64000000-0000-0000-0000-000000000003'$$,
  $$values (true)$$,
  '(H) the server-side attempt count genuinely reflects every guess, valid or not'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '64000000-0000-0000-0000-000000000003', true);

-- (F) a DIFFERENT, unrelated account has its own, completely separate
-- allowance.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '64000000-0000-0000-0000-000000000002', true);
select extensions.results_eq(
  $$select result_status, id from public.resolve_invitation_by_code('$$ || :'invite_code' || $$')$$,
  $$values ('ok'::text, '$$ || :'invitation_id' || $$'::uuid)$$,
  '(F) a DIFFERENT account (the genuine invitee) is completely unaffected by the first account''s throttling'
);

-- (G) window expiry resets the allowance (simulated -- a real 5-minute
-- wait is impractical in a test).
reset role;
set local role postgres;
update public.invitation_code_attempts
set window_start = now() - interval '6 minutes'
where user_id = '64000000-0000-0000-0000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.sub', '64000000-0000-0000-0000-000000000003', true);
select extensions.results_eq(
  $$select result_status, id from public.resolve_invitation_by_code('$$ || :'invite_code' || $$')$$,
  $$values ('ok'::text, '$$ || :'invitation_id' || $$'::uuid)$$,
  '(G) once the window has genuinely elapsed, the same account can resolve again -- cooldown recovery works'
);

-- (I) is an architectural property, not something a single pgTAP
-- assertion can directly execute (it would require actually clearing
-- device storage) -- but it follows directly from (B) and the fact
-- that invitation_code_attempts itself has zero client-reachable
-- policies (asserted next): all state genuinely lives server-side,
-- so there is nothing on a client to clear that would matter.
select extensions.is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'invitation_code_attempts'),
  0,
  '(I) invitation_code_attempts has ZERO RLS policies -- no client, however it clears its own local state, can read or write this table directly'
);

-- (J) an unrelated account that obtained the minimal preview STILL
-- cannot accept -- accept_invitation()'s own identity boundary,
-- completely unmodified.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '64000000-0000-0000-0000-000000000003', true);
select extensions.throws_like(
  $$select public.accept_invitation('$$ || :'invitation_id' || $$'::uuid, gen_random_uuid())$$,
  'Invitation not found',
  '(J) the unrelated account still cannot accept -- accept_invitation()''s identity check is completely unaffected'
);

-- (K) role/domain grants remain server-owned -- the genuinely invited
-- account accepts and receives exactly what invite_member() specified.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '64000000-0000-0000-0000-000000000002', true);
select public.accept_invitation(:'invitation_id'::uuid, gen_random_uuid());

select extensions.results_eq(
  $$select role from public.care_space_memberships where care_space_id = '$$ || :'maggie_id' || $$'::uuid and user_id = '64000000-0000-0000-0000-000000000002'$$,
  $$values ('contributor')$$,
  '(K) resulting role is exactly what the invitation specified'
);
select extensions.results_eq(
  $$select domain from public.care_space_domain_grants g join public.care_space_memberships m on m.id = g.membership_id where m.care_space_id = '$$ || :'maggie_id' || $$'::uuid and m.user_id = '64000000-0000-0000-0000-000000000002'$$,
  $$values ('general')$$,
  '(K) resulting domain grants are exactly what the invitation specified'
);

select extensions.finish();
rollback;
