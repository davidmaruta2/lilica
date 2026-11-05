begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(6);

insert into auth.users (id, email)
values ('af000000-0000-0000-0000-000000000001', 'af-one@example.test');

-- 1-2. The new event name is accepted, once.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'af000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.log_activation_event('invitation_accepted', 'android', '1.0.1')$$,
  'an authenticated user can log invitation_accepted'
);
select lives_ok(
  $$select public.log_activation_event('invitation_accepted', 'android', '1.0.1')$$,
  'logging invitation_accepted again is a silent no-op'
);

-- 3. Still exactly one row for it.
reset role;
set local role postgres;
select is(
  (select count(*)::int from public.activation_events
    where user_id = 'af000000-0000-0000-0000-000000000001' and event_name = 'invitation_accepted'),
  1,
  'invitation_accepted produced exactly one row'
);

-- 4. Every name that was allowed before is still allowed.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'af000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select
      public.log_activation_event('account_ready'),
      public.log_activation_event('person_added'),
      public.log_activation_event('first_record_added'),
      public.log_activation_event('invite_created'),
      public.log_activation_event('care_summary_created'),
      public.log_activation_event('paywall_viewed'),
      public.log_activation_event('trial_notice_viewed'),
      public.log_activation_event('review_prompt_shown')$$,
  'all eight original event names are still accepted'
);

-- 5. A name outside the list is still rejected.
select throws_ok(
  $$select public.log_activation_event('invitation_declined')$$,
  '22023',
  'Unknown activation event',
  'an event outside the allowlist is still rejected'
);

-- 6. Events are still removed with the account.
reset role;
set local role postgres;
delete from auth.users where id = 'af000000-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.activation_events where user_id = 'af000000-0000-0000-0000-000000000001'),
  0,
  'deleting the account removes all of its activation events'
);

select * from finish();
rollback;
