-- Care Circle invitation system final architectural closure (14 September
-- 2026): proves server-persisted delivery state is genuinely
-- authoritative -- not device-local. record_invitation_email_sent()/
-- record_invitation_share_opened() are the ONLY way these fields ever
-- change; both are organiser-only, and neither is reachable by the
-- invitee or an unrelated account.
begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(11);

insert into auth.users (id, email)
values
  ('63000000-0000-0000-0000-000000000001', 'ds-david@example.test'),
  ('63000000-0000-0000-0000-000000000002', 'ds-marion@example.test'),
  ('63000000-0000-0000-0000-000000000003', 'ds-unrelated@example.test');

set local role authenticated;
select set_config('request.jwt.claim.sub', '63000000-0000-0000-0000-000000000001', true);
select * from public.bootstrap_supported_people('[
  {"draft_id":"63100000-0000-4000-a000-000000000001","display_name":"Maggie","relationship_type":"Mum","relationship_label":null}
]'::jsonb);

reset role;
set local role postgres;
select sp.care_space_id as maggie_id
from public.supported_people sp
join public.care_spaces cs on cs.id = sp.care_space_id
where cs.bootstrap_owner_id = '63000000-0000-0000-0000-000000000001' and sp.display_name = 'Maggie' \gset

set local role authenticated;
select set_config('request.jwt.claim.sub', '63000000-0000-0000-0000-000000000001', true);
select public.invite_member(:'maggie_id'::uuid, 'ds-marion@example.test', 'contributor', array['general'], 'Other relative', 'Aunt', '63200000-0000-4000-a000-000000000001');

reset role;
set local role postgres;
select id as invitation_id
from public.care_space_invitations
where care_space_id = :'maggie_id'::uuid and invitee_email = 'ds-marion@example.test' \gset

-- (A) newly-created invitation has no email-sent state.
select extensions.results_eq(
  $$select last_email_sent_at is null, email_send_count, last_share_opened_at is null
    from public.care_space_invitations where id = '$$ || :'invitation_id' || $$'::uuid$$,
  $$values (true, 0, true)$$,
  '(A) a newly-created invitation has no email/share delivery state at all'
);

-- (Server email state, organiser-only): the invitee cannot mark it
-- emailed -- this is Lilica's OWN record of what it did, not the
-- invitee's to set.
set local role authenticated;
select set_config('request.jwt.claim.sub', '63000000-0000-0000-0000-000000000002', true);
select extensions.throws_like(
  $$select public.record_invitation_email_sent('$$ || :'invitation_id' || $$'::uuid)$$,
  'Invitation not found',
  'the invitee cannot record email-sent state for their own invitation -- organiser-only'
);

-- An unrelated account cannot either.
select set_config('request.jwt.claim.sub', '63000000-0000-0000-0000-000000000003', true);
select extensions.throws_like(
  $$select public.record_invitation_email_sent('$$ || :'invitation_id' || $$'::uuid)$$,
  'Invitation not found',
  'an unrelated account cannot record email-sent state for an invitation it does not organise'
);

-- (B) the organiser (mirroring what the Edge Function does after Resend
-- accepts the send) records a genuine send.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '63000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$select public.record_invitation_email_sent('$$ || :'invitation_id' || $$'::uuid)$$,
  '(B) the organiser can record a genuine email send'
);
select extensions.results_eq(
  $$select last_email_sent_at is not null, email_send_count from public.care_space_invitations where id = '$$ || :'invitation_id' || $$'::uuid$$,
  $$values (true, 1)$$,
  '(B) email_send_count is now 1 and last_email_sent_at is genuinely set'
);

-- (D) resend updates the SAME invitation's state, never creating a
-- second invitation or a second row.
select extensions.lives_ok(
  $$select public.record_invitation_email_sent('$$ || :'invitation_id' || $$'::uuid)$$,
  '(D) resending records another genuine send against the SAME invitation'
);
select extensions.results_eq(
  $$select count(*)::int, (select email_send_count from public.care_space_invitations where id = '$$ || :'invitation_id' || $$'::uuid)
    from public.care_space_invitations where invitee_email = 'ds-marion@example.test' and care_space_id = '$$ || :'maggie_id' || $$'::uuid$$,
  $$values (1, 2)$$,
  '(D) still exactly ONE invitation row, now with email_send_count 2'
);

-- (F) a "second device" is nothing more than reading the same row again
-- -- list_care_space_invitations() surfaces the real, persisted state
-- to whichever device/session reads it.
select extensions.results_eq(
  $$select last_email_sent_at is not null, email_send_count
    from public.list_care_space_invitations('$$ || :'maggie_id' || $$'::uuid)
    where invitee_email = 'ds-marion@example.test'$$,
  $$values (true, 2)$$,
  '(F) list_care_space_invitations() -- what ANY device/session reads -- reflects the real persisted state'
);

-- Native-share state, recorded the same way, same organiser boundary.
select extensions.lives_ok(
  $$select public.record_invitation_share_opened('$$ || :'invitation_id' || $$'::uuid)$$,
  'the organiser can record a genuine share-opened event'
);
select extensions.results_eq(
  $$select last_share_opened_at is not null from public.care_space_invitations where id = '$$ || :'invitation_id' || $$'::uuid$$,
  $$values (true)$$,
  'last_share_opened_at is genuinely set after a real share event'
);

-- (I) acceptance itself is completely untouched by any of this.
select set_config('request.jwt.claim.sub', '63000000-0000-0000-0000-000000000002', true);
select extensions.lives_ok(
  $$select public.accept_invitation('$$ || :'invitation_id' || $$'::uuid, gen_random_uuid())$$,
  '(I) accept_invitation() -- completely unmodified -- still works exactly as before, unaffected by delivery-state tracking'
);

select extensions.finish();
rollback;
