-- Care Circle invitation system final architectural closure (14 September
-- 2026): proves resolve_invitation_by_code()'s rate limiting --
-- server-authoritative (a small database-backed sliding-window counter,
-- invitation_code_attempts, with NO client-readable/writable policies
-- at all -- only the SECURITY DEFINER functions themselves can touch
-- it, so clearing local storage/reinstalling cannot reset it), scoped
-- per account, and does not disturb the identity/acceptance boundary.
-- Threshold: 10 attempts per rolling 5-minute window per account.
--
-- record_invitation_code_attempt() is called SEPARATELY, before
-- resolve_invitation_by_code() (see the migration's own header comment
-- for why this must be a genuinely separate call -- a real Postgres
-- transactional-semantics constraint, not a style choice: a single
-- function's own earlier counter increment is rolled back by that
-- SAME function later raising "not found", so the two are split into
-- independently-committed calls). This test drives the counter the
-- same way the real client does.
begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(11);

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
select invite_code from public.care_space_invitations
where care_space_id = :'maggie_id'::uuid and invitee_email = 'rl-marion@example.test' \gset

-- The caller for the rest of this file is the unrelated account -- its
-- own attempts, its own allowance, never touching the invitee/organiser.
set local role authenticated;
select set_config('request.jwt.claim.sub', '64000000-0000-0000-0000-000000000003', true);

-- (normal valid lookup, and typo/retry remains practical): a few
-- deliberate wrong guesses, then the correct code -- all well under the
-- threshold, still succeeds. Each "attempt" is the real client's own
-- two-call sequence: record the attempt, then resolve.
select extensions.lives_ok($$select public.record_invitation_code_attempt()$$, 'attempt 1: recorded');
select extensions.throws_like($$select * from public.resolve_invitation_by_code('WRONGONE')$$, 'We could not find an active invitation with that code', 'attempt 1: a wrong guess fails safely');
select extensions.lives_ok($$select public.record_invitation_code_attempt()$$, 'attempt 2: recorded');
select extensions.throws_like($$select * from public.resolve_invitation_by_code('WRONGTWO')$$, 'We could not find an active invitation with that code', 'attempt 2: another wrong guess');

select extensions.lives_ok($$select public.record_invitation_code_attempt()$$, 'attempt 3: recorded');
select extensions.lives_ok(
  $$select * from public.resolve_invitation_by_code('$$ || :'invite_code' || $$')$$,
  'attempt 3: the real code still resolves normally -- ordinary typo/retry is never blocked'
);

-- Drive this SAME account to the threshold with more attempts (3 so
-- far; 7 more reaches 10) -- only the counter half needs to run here,
-- since we're only proving the throttle boundary, not re-proving the
-- lookup logic again.
select extensions.lives_ok(
  $$do $inner$
    begin
      for i in 1..7 loop
        perform public.record_invitation_code_attempt();
      end loop;
    end;
  $inner$;
  $$,
  'attempts 4-10: seven more recorded attempts reach the 10-attempt window exactly, still not throttled'
);

-- The 11th attempt in the same window is throttled -- at the recording
-- step itself, before any lookup even happens.
select extensions.throws_like(
  $$select public.record_invitation_code_attempt()$$,
  'Too many attempts. Please wait a few minutes and try again.',
  'attempt 11: throttled at the recording step -- learns nothing about any code, valid or not'
);

-- Scoped per account: a DIFFERENT, unrelated account has its own,
-- completely unaffected allowance.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '64000000-0000-0000-0000-000000000002', true);
select extensions.lives_ok(
  $$select public.record_invitation_code_attempt()$$,
  'a DIFFERENT account (the genuine invitee) is completely unaffected by the first account''s throttling -- its own separate allowance'
);

-- Cooldown/window recovery: simulate the window having elapsed (real
-- 5-minute wall-clock wait is not practical in a test -- move the
-- recorded window_start back directly, as postgres, exactly as time
-- passing would).
reset role;
set local role postgres;
update public.invitation_code_attempts
set window_start = now() - interval '6 minutes'
where user_id = '64000000-0000-0000-0000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.sub', '64000000-0000-0000-0000-000000000003', true);
select extensions.lives_ok(
  $$select public.record_invitation_code_attempt()$$,
  'once the 5-minute window has genuinely elapsed, the throttled account can record an attempt again -- cooldown recovery works'
);

-- Successful resolution never grants membership by itself, and
-- accept_invitation()'s own identity enforcement is completely
-- unaffected by any of the rate-limit changes.
select extensions.throws_like(
  $$select public.accept_invitation((select id from public.resolve_invitation_by_code('$$ || :'invite_code' || $$')), gen_random_uuid())$$,
  'Invitation not found',
  'the unrelated account resolving the code STILL cannot accept it -- accept_invitation()''s identity check is completely unaffected by rate limiting'
);

select extensions.finish();
rollback;
