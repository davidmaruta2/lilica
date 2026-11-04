-- Growth plan item 5 (3 November 2026): privacy-safe first-party activation
-- events, so the funnel (account ready -> person -> first record -> invite
-- -> Care Summary -> paywall) can finally be measured.
--
-- Privacy position (needs David's approval before this reaches production):
--   * one row per (user, event name) - the first time it happened, nothing
--     more. No payload, no record/person/care-space ids, no free text.
--   * event names come from a fixed allowlist enforced here, not by the client.
--   * rows are deleted with the account (ON DELETE CASCADE), so
--     delete_my_account() needs no change.
--   * no client can read the table; it exists for aggregate reporting only.
--   * no third-party SDK is involved.

create table public.activation_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_name text not null,
  platform text,
  app_version text,
  first_seen_at timestamptz not null default statement_timestamp(),
  primary key (user_id, event_name),
  constraint activation_events_name_allowlist check (event_name in (
    'account_ready',
    'person_added',
    'first_record_added',
    'invite_created',
    'care_summary_created',
    'paywall_viewed',
    'trial_notice_viewed',
    'review_prompt_shown'
  )),
  constraint activation_events_platform_check check (platform is null or platform in ('ios', 'android')),
  constraint activation_events_version_length check (app_version is null or char_length(app_version) <= 20)
);

comment on table public.activation_events is
  'Growth plan: first occurrence of a small allowlist of product milestones per user. No payload, no care data. Deleted with the account. Aggregate reporting only; no client policy exists.';

alter table public.activation_events enable row level security;
alter table public.activation_events force row level security;
revoke all on public.activation_events from anon, authenticated;

create or replace function public.log_activation_event(
  p_event_name text,
  p_platform text default null,
  p_app_version text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.activation_events (user_id, event_name, platform, app_version)
  values (caller_id, p_event_name, p_platform, left(p_app_version, 20))
  on conflict (user_id, event_name) do nothing;
exception
  when check_violation then
    raise exception 'Unknown activation event' using errcode = '22023';
end;
$$;

revoke all on function public.log_activation_event(text, text, text) from public, anon;
grant execute on function public.log_activation_event(text, text, text) to authenticated;
