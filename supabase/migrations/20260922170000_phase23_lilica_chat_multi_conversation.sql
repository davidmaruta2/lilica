-- Phase 23 slice 5: multiple conversations, not one endless thread.
--
-- Direct product-owner decision (22 September 2026): a single never-ending
-- Lilica Chat thread and a single never-ending DM per person "won't work"
-- -- both need a real "Start new conversation" action, with old ones kept
-- in a reopenable list, same idea as starting a new email thread. Record-
-- linked chat is UNCHANGED -- still exactly one thread per record, since
-- nothing about that ask concerned it.
--
-- Also, in the same decision: subject tagging (slice 4, care_circle-only)
-- now extends to direct messages too -- a tagged DM message surfaces in
-- the record's shared conversation exactly like a tagged Lilica Chat
-- message does. This is a deliberate, explicit privacy trade-off David
-- chose knowingly (the alternative -- private-only DM tags -- was offered
-- and declined): a DM message tagged to a record becomes visible to
-- anyone with that record's own domain access, not just the two DM
-- participants. Recorded here so this is never mistaken for an oversight.

alter table public.chat_threads
  add column title text,
  add column created_by_membership_id uuid references public.care_space_memberships (id) on delete restrict;

comment on column public.chat_threads.title is 'Phase 23 slice 5: optional, for care_circle/direct threads only (a record thread is already named by its own record). Null shows an auto-generated "Conversation started <date>" label client-side.';

-- Both uniqueness constraints that forced exactly one shared thread per
-- care space and exactly one direct thread per pair are gone -- multiple
-- conversations of each kind are now the real model. chat_threads_record_
-- idx (one thread per record) is UNCHANGED, deliberately -- that ask was
-- never about record-linked chat.
alter table public.chat_threads drop constraint chat_threads_one_care_circle_per_space;
drop index public.chat_threads_direct_pair_idx;

-- ---------------------------------------------------------------------
-- get_or_create_care_circle_thread / get_or_create_direct_thread:
-- redefined to mean "the most recently active existing conversation of
-- this kind, or a fresh first one if none exists yet" -- this is what a
-- plain tap on "Lilica Chat" or a member's "Chat" link opens by default;
-- start_new_conversation() below is the only way to deliberately begin a
-- new one instead of continuing the most recent.
-- ---------------------------------------------------------------------

create or replace function public.get_or_create_care_circle_thread(target_care_space_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  found_thread_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_care_space_member(target_care_space_id) then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  select ct.id into found_thread_id
  from public.chat_threads ct
  where ct.care_space_id = target_care_space_id and ct.kind = 'care_circle'
  order by ct.created_at desc
  limit 1;

  if found_thread_id is not null then
    return found_thread_id;
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);

  insert into public.chat_threads (care_space_id, kind, created_by_membership_id)
  values (target_care_space_id, 'care_circle', caller_membership_id)
  returning id into found_thread_id;

  return found_thread_id;
end;
$$;

create or replace function public.get_or_create_direct_thread(target_care_space_id uuid, other_membership_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  member_a uuid;
  member_b uuid;
  found_thread_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  if other_membership_id = caller_membership_id then
    raise exception 'Cannot start a direct message with yourself' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.care_space_memberships m
    where m.id = other_membership_id
      and m.care_space_id = target_care_space_id
      and m.membership_status = 'active'
  ) then
    raise exception 'That person is not an active member of this care space' using errcode = '42501';
  end if;

  if caller_membership_id < other_membership_id then
    member_a := caller_membership_id;
    member_b := other_membership_id;
  else
    member_a := other_membership_id;
    member_b := caller_membership_id;
  end if;

  select ct.id into found_thread_id
  from public.chat_threads ct
  where ct.care_space_id = target_care_space_id and ct.kind = 'direct'
    and ct.direct_member_a = member_a and ct.direct_member_b = member_b
  order by ct.created_at desc
  limit 1;

  if found_thread_id is not null then
    return found_thread_id;
  end if;

  insert into public.chat_threads (care_space_id, kind, direct_member_a, direct_member_b, created_by_membership_id)
  values (target_care_space_id, 'direct', member_a, member_b, caller_membership_id)
  returning id into found_thread_id;

  return found_thread_id;
end;
$$;

-- ---------------------------------------------------------------------
-- start_new_conversation: the ONLY way to deliberately begin a fresh
-- care_circle or direct thread rather than continuing the most recent
-- one -- never used for kind='record' (that stays exactly one thread per
-- record, unchanged).
-- ---------------------------------------------------------------------

create function public.start_new_conversation(
  target_care_space_id uuid,
  thread_kind text,
  other_membership_id uuid default null,
  conversation_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  member_a uuid;
  member_b uuid;
  trimmed_title text;
  new_thread_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if thread_kind not in ('care_circle', 'direct') then
    raise exception 'Cannot start a new conversation of this kind' using errcode = '22023';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  trimmed_title := nullif(btrim(coalesce(conversation_title, '')), '');
  if trimmed_title is not null and char_length(trimmed_title) > 80 then
    raise exception 'Conversation title is too long' using errcode = '22023';
  end if;

  if thread_kind = 'care_circle' then
    if not public.is_care_space_member(target_care_space_id) then
      raise exception 'Active care-space membership required' using errcode = '42501';
    end if;

    insert into public.chat_threads (care_space_id, kind, title, created_by_membership_id)
    values (target_care_space_id, 'care_circle', trimmed_title, caller_membership_id)
    returning id into new_thread_id;
  else
    if other_membership_id is null then
      raise exception 'A direct message needs the other member' using errcode = '22023';
    end if;
    if other_membership_id = caller_membership_id then
      raise exception 'Cannot start a direct message with yourself' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.care_space_memberships m
      where m.id = other_membership_id
        and m.care_space_id = target_care_space_id
        and m.membership_status = 'active'
    ) then
      raise exception 'That person is not an active member of this care space' using errcode = '42501';
    end if;

    if caller_membership_id < other_membership_id then
      member_a := caller_membership_id; member_b := other_membership_id;
    else
      member_a := other_membership_id; member_b := caller_membership_id;
    end if;

    insert into public.chat_threads (care_space_id, kind, direct_member_a, direct_member_b, title, created_by_membership_id)
    values (target_care_space_id, 'direct', member_a, member_b, trimmed_title, caller_membership_id)
    returning id into new_thread_id;
  end if;

  return new_thread_id;
end;
$$;

revoke all on function public.start_new_conversation(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.start_new_conversation(uuid, text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- list_my_conversations: every conversation of the given kind the caller
-- can access (all Lilica Chat conversations for the space, or every DM
-- thread with one specific partner), most recently active first -- this
-- is the real "list of conversations, reopen an old one" screen's data
-- source. Record-linked chat has no equivalent list -- it is still
-- exactly one thread per record.
-- ---------------------------------------------------------------------

create function public.list_my_conversations(
  target_care_space_id uuid,
  thread_kind text,
  other_membership_id uuid default null
)
returns table (
  thread_id uuid,
  title text,
  created_at timestamptz,
  last_message_at timestamptz,
  last_message_body text,
  last_message_sender_is_self boolean,
  unread_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if thread_kind not in ('care_circle', 'direct') then
    raise exception 'Cannot list conversations of this kind' using errcode = '22023';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  if thread_kind = 'direct' and other_membership_id is null then
    raise exception 'Listing direct conversations needs the other member' using errcode = '22023';
  end if;

  return query
  with rows as (
    select
      t.id as row_thread_id,
      t.title as row_title,
      t.created_at as row_created_at,
      (select max(m.created_at) from public.chat_messages m where m.thread_id = t.id) as row_last_message_at,
      (select m.body from public.chat_messages m where m.thread_id = t.id and m.deleted_at is null order by m.created_at desc limit 1) as row_last_message_body,
      (select m.sender_membership_id = caller_membership_id from public.chat_messages m where m.thread_id = t.id order by m.created_at desc limit 1) as row_last_message_sender_is_self,
      coalesce((
        select count(*) from public.chat_messages m
        left join public.chat_thread_reads r on r.thread_id = t.id and r.membership_id = caller_membership_id
        where m.thread_id = t.id
          and m.deleted_at is null
          and m.sender_membership_id <> caller_membership_id
          and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
      ), 0)::integer as row_unread_count
    from public.chat_threads t
    where t.care_space_id = target_care_space_id
      and t.kind = thread_kind
      and (
        (thread_kind = 'care_circle' and public.is_care_space_member(target_care_space_id))
        or (thread_kind = 'direct' and other_membership_id in (t.direct_member_a, t.direct_member_b)
            and caller_membership_id in (t.direct_member_a, t.direct_member_b))
      )
  )
  select row_thread_id, row_title, row_created_at, row_last_message_at, row_last_message_body, row_last_message_sender_is_self, row_unread_count
  from rows
  order by coalesce(row_last_message_at, row_created_at) desc;
end;
$$;

revoke all on function public.list_my_conversations(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.list_my_conversations(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- send_chat_message: subject tagging now allowed from a direct thread
-- too, not just care_circle -- same explicit trade-off noted at the top
-- of this migration.
-- ---------------------------------------------------------------------

create or replace function public.send_chat_message(target_thread_id uuid, message_body text, subject_record_id uuid default null)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_thread public.chat_threads%rowtype;
  caller_membership_id uuid;
  result_message public.chat_messages%rowtype;
  trimmed_body text;
  subject_record public.records%rowtype;
  subject_domain text;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select ct.* into target_thread from public.chat_threads ct where ct.id = target_thread_id;
  if not found or not public.can_access_chat_thread(target_thread_id) then
    raise exception 'Thread not found' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_thread.care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  trimmed_body := btrim(coalesce(message_body, ''));
  if char_length(trimmed_body) < 1 or char_length(trimmed_body) > 4000 then
    raise exception 'Message must be between 1 and 4000 characters' using errcode = '22023';
  end if;

  if subject_record_id is not null then
    if target_thread.kind not in ('care_circle', 'direct') then
      raise exception 'A subject can only be added to a Lilica Chat or direct message' using errcode = '22023';
    end if;

    select * into subject_record from public.records where id = subject_record_id;
    if not found or subject_record.deleted_at is not null or subject_record.care_space_id <> target_thread.care_space_id then
      raise exception 'Subject record not found' using errcode = '42501';
    end if;

    subject_domain := public.record_domain_for_type(subject_record.record_type);
    if not public.can_access_care_space_records(target_thread.care_space_id, subject_domain, 'read') then
      raise exception 'Insufficient permission for this record domain' using errcode = '42501';
    end if;
  end if;

  insert into public.chat_messages (thread_id, care_space_id, sender_membership_id, body, subject_record_id)
  values (target_thread_id, target_thread.care_space_id, caller_membership_id, trimmed_body, subject_record_id)
  returning * into result_message;

  insert into public.chat_thread_reads (thread_id, membership_id, last_read_at)
  values (target_thread_id, caller_membership_id, result_message.created_at)
  on conflict (thread_id, membership_id) do update
    set last_read_at = excluded.last_read_at
    where excluded.last_read_at > public.chat_thread_reads.last_read_at;

  return result_message;
end;
$$;
