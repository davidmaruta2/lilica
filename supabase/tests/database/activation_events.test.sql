begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(9);

insert into auth.users (id, email)
values
  ('ae000000-0000-0000-0000-000000000001', 'ae-one@example.test'),
  ('ae000000-0000-0000-0000-000000000002', 'ae-two@example.test');

-- 1. Anonymous callers cannot log events.
set local role anon;
select throws_ok(
  $$select public.log_activation_event('account_ready', 'ios', '1.0.0')$$,
  '42501',
  null,
  'anon cannot log an activation event'
);

-- 2-4. An authenticated user can log an allowlisted event, once.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ae000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.log_activation_event('account_ready', 'ios', '1.0.0')$$,
  'authenticated user can log account_ready'
);
select lives_ok(
  $$select public.log_activation_event('account_ready', 'ios', '1.0.0')$$,
  'logging the same event again is a silent no-op'
);
select throws_ok(
  $$select public.log_activation_event('not_a_real_event')$$,
  '22023',
  'Unknown activation event',
  'an event outside the allowlist is rejected'
);

-- 5. No client can read the table directly.
select throws_ok(
  $$select count(*) from public.activation_events$$,
  '42501',
  null,
  'authenticated users cannot read activation_events'
);

-- 6-7. Server side: one row, per user, correct content.
reset role;
set local role postgres;
select is(
  (select count(*)::int from public.activation_events where user_id = 'ae000000-0000-0000-0000-000000000001'),
  1,
  'the repeated event produced exactly one row'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ae000000-0000-0000-0000-000000000002', true);
select public.log_activation_event('first_record_added', 'android', '1.0.0');
reset role;
set local role postgres;
select is(
  (select count(*)::int from public.activation_events),
  2,
  'a second user gets their own separate row'
);

-- 8. An invalid platform is rejected.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ae000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.log_activation_event('person_added', 'web', '1.0.0')$$,
  '22023',
  'Unknown activation event',
  'an unsupported platform is rejected'
);

-- 9. Events are removed with the account.
reset role;
set local role postgres;
delete from auth.users where id = 'ae000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.activation_events where user_id = 'ae000000-0000-0000-0000-000000000001'),
  0,
  'deleting the account removes its activation events'
);

select * from finish();
rollback;
