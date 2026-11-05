-- Growth plan, finding G1 (5 November 2026): a person who joins through an
-- invitation never goes through the organiser onboarding, so none of the
-- existing activation events fire for them and they look as if they never
-- activated. Add one more allow-listed event name, invitation_accepted, that
-- the app logs when someone accepts an invitation.
--
-- Privacy position is unchanged from 20261104090000_activation_events.sql:
-- one row per user per event name, no payload, no care data, no ids of the
-- invitation or care space, deleted with the account, no client can read the
-- table. This migration only widens the fixed allowlist by one name.
--
-- Safe to apply while the app is live: the previous allowlist is a subset of
-- the new one, so every existing row still satisfies the constraint, and the
-- app only starts sending the new name after it ships. An older app that
-- sends it earlier than this migration would simply be rejected and retried.

alter table public.activation_events
  drop constraint if exists activation_events_name_allowlist;

alter table public.activation_events
  add constraint activation_events_name_allowlist check (event_name in (
    'account_ready',
    'person_added',
    'first_record_added',
    'invite_created',
    'care_summary_created',
    'paywall_viewed',
    'trial_notice_viewed',
    'review_prompt_shown',
    'invitation_accepted'
  ));
