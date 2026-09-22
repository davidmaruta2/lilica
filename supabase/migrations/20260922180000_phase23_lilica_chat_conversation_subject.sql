-- Phase 23 slice 6: a conversation's own subject, chosen when you start
-- it -- direct product-owner report (22 September 2026): the collapsed
-- conversation-list view ("Conversation started 22 Sept" / last message
-- snippet) gives no indication at all what a conversation is actually
-- about. start_new_conversation() gains an optional subject_record_id
-- (Medical Log item) alongside the existing free-text conversation_title
-- -- exactly one of the two, never both, chosen once at creation, and
-- that becomes what the conversation is known by in its collapsed view.
--
-- Once a conversation has its own subject_record_id, every message sent
-- into it is AUTOMATICALLY tagged with that same record as its own
-- per-message subject (send_chat_message below) -- no need to re-pick a
-- subject on every individual message once the whole conversation is
-- already about one thing. The per-message picker (slice 4) remains for
-- a conversation with no subject of its own, or to deliberately tag one
-- particular message to a DIFFERENT record than the conversation's own.

alter table public.chat_threads
  add column subject_record_id uuid references public.records (id) on delete restrict;

alter table public.chat_threads add constraint chat_threads_subject_shape check (
  subject_record_id is null or kind in ('care_circle', 'direct')
);

comment on column public.chat_threads.subject_record_id is 'Phase 23 slice 6: for care_circle/direct threads only -- the Medical Log record this whole conversation is about, chosen once at creation. Never set alongside title (mutually exclusive, enforced in start_new_conversation). A kind=record thread never sets this -- it is already about exactly its own record_id.';

-- ---------------------------------------------------------------------
-- start_new_conversation: gains subject_record_id. Mutually exclusive
-- with conversation_title -- a conversation is known by ONE subject,
-- either a real Medical Log item or a free-text label, never both.
-- ---------------------------------------------------------------------

create or replace function public.start_new_conversation(
  target_care_space_id uuid,
  thread_kind text,
  other_membership_id uuid default null,
  conversation_title text default null,
  subject_record_id uuid default null
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
  subject_record public.records%rowtype;
  subject_domain text;
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

  if trimmed_title is not null and subject_record_id is not null then
    raise exception 'A conversation has one subject -- a record or a title, never both' using errcode = '22023';
  end if;

  if subject_record_id is not null then
    select * into subject_record from public.records where id = subject_record_id;
    if not found or subject_record.deleted_at is not null or subject_record.care_space_id <> target_care_space_id then
      raise exception 'Subject record not found' using errcode = '42501';
    end if;

    subject_domain := public.record_domain_for_type(subject_record.record_type);
    if not public.can_access_care_space_records(target_care_space_id, subject_domain, 'read') then
      raise exception 'Insufficient permission for this record domain' using errcode = '42501';
    end if;
  end if;

  if thread_kind = 'care_circle' then
    if not public.is_care_space_member(target_care_space_id) then
      raise exception 'Active care-space membership required' using errcode = '42501';
    end if;

    insert into public.chat_threads (care_space_id, kind, title, subject_record_id, created_by_membership_id)
    values (target_care_space_id, 'care_circle', trimmed_title, subject_record_id, caller_membership_id)
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

    insert into public.chat_threads (care_space_id, kind, direct_member_a, direct_member_b, title, subject_record_id, created_by_membership_id)
    values (target_care_space_id, 'direct', member_a, member_b, trimmed_title, subject_record_id, caller_membership_id)
    returning id into new_thread_id;
  end if;

  return new_thread_id;
end;
$$;

-- ---------------------------------------------------------------------
-- list_my_conversations: gains the resolved subject (id + real current
-- title, resolved fresh on each read, same as message-level tagging --
-- never a copied/stale snapshot).
-- ---------------------------------------------------------------------

drop function public.list_my_conversations(uuid, text, uuid);

create function public.list_my_conversations(
  target_care_space_id uuid,
  thread_kind text,
  other_membership_id uuid default null
)
returns table (
  thread_id uuid,
  title text,
  subject_record_id uuid,
  subject_record_title text,
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
      t.subject_record_id as row_subject_record_id,
      sr.record_data->>'title' as row_subject_record_title,
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
    left join public.records sr on sr.id = t.subject_record_id
    where t.care_space_id = target_care_space_id
      and t.kind = thread_kind
      and (
        (thread_kind = 'care_circle' and public.is_care_space_member(target_care_space_id))
        or (thread_kind = 'direct' and other_membership_id in (t.direct_member_a, t.direct_member_b)
            and caller_membership_id in (t.direct_member_a, t.direct_member_b))
      )
  )
  select row_thread_id, row_title, row_subject_record_id, row_subject_record_title, row_created_at, row_last_message_at, row_last_message_body, row_last_message_sender_is_self, row_unread_count
  from rows
  order by coalesce(row_last_message_at, row_created_at) desc;
end;
$$;

revoke all on function public.list_my_conversations(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.list_my_conversations(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- send_chat_message: a message sent with no explicit subject_record_id
-- of its own now inherits the THREAD's own subject_record_id, if it has
-- one -- every message in a conversation that's already about "Metformin"
-- is automatically tagged, without re-picking a subject each time.
-- Passing an explicit subject_record_id still overrides this (tag one
-- particular message to something else within a general conversation).
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
  effective_subject_record_id uuid;
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

  effective_subject_record_id := coalesce(subject_record_id, target_thread.subject_record_id);

  if effective_subject_record_id is not null then
    if target_thread.kind not in ('care_circle', 'direct') then
      raise exception 'A subject can only be added to a Lilica Chat or direct message' using errcode = '22023';
    end if;

    select * into subject_record from public.records where id = effective_subject_record_id;
    if not found or subject_record.deleted_at is not null or subject_record.care_space_id <> target_thread.care_space_id then
      raise exception 'Subject record not found' using errcode = '42501';
    end if;

    subject_domain := public.record_domain_for_type(subject_record.record_type);
    if not public.can_access_care_space_records(target_thread.care_space_id, subject_domain, 'read') then
      raise exception 'Insufficient permission for this record domain' using errcode = '42501';
    end if;
  end if;

  insert into public.chat_messages (thread_id, care_space_id, sender_membership_id, body, subject_record_id)
  values (target_thread_id, target_thread.care_space_id, caller_membership_id, trimmed_body, effective_subject_record_id)
  returning * into result_message;

  insert into public.chat_thread_reads (thread_id, membership_id, last_read_at)
  values (target_thread_id, caller_membership_id, result_message.created_at)
  on conflict (thread_id, membership_id) do update
    set last_read_at = excluded.last_read_at
    where excluded.last_read_at > public.chat_thread_reads.last_read_at;

  return result_message;
end;
$$;
