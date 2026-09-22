-- Phase 23 slice 4: subject tagging -- when sending into Lilica Chat (the
-- shared thread only, never a direct message), you can optionally tag the
-- message with a Medical Log record as its "subject". That message then
-- also shows up in the tagged record's own conversation, alongside
-- whatever it already has in its dedicated record-linked thread (slice 3).
--
-- Deliberately shared-thread only: a direct message is private between
-- two people, and tagging it would silently surface private conversation
-- content to anyone else with health-domain access via the record's own
-- conversation view -- a real privacy leak, not a feature. Enforced in
-- send_chat_message() below (the thread must be kind = 'care_circle'),
-- not a table CHECK constraint, since that needs a cross-table lookup
-- against chat_threads -- matching how every other cross-table rule in
-- this schema is enforced in its owning RPC.
--
-- The message itself is stored ONCE, in its real origin thread (Lilica
-- Chat) -- tagging never duplicates or moves it. A record's own
-- "conversation" becomes the union of its dedicated record-thread
-- messages (if any) and any shared-chat messages tagged with its id,
-- read via the new list_record_conversation() below.

alter table public.chat_messages
  add column subject_record_id uuid references public.records (id) on delete restrict;

create index chat_messages_subject_record_idx on public.chat_messages (subject_record_id) where subject_record_id is not null;

comment on column public.chat_messages.subject_record_id is 'Phase 23 slice 4: optional Medical Log record this Lilica Chat message is tagged to. Only ever set for messages sent into a kind=care_circle thread -- enforced in send_chat_message(), never for a direct message.';

-- ---------------------------------------------------------------------
-- send_chat_message: redefined to accept the optional subject.
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
    if target_thread.kind <> 'care_circle' then
      raise exception 'A subject can only be added to a Lilica Chat message' using errcode = '22023';
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

-- ---------------------------------------------------------------------
-- list_chat_messages: redefined to also return the subject (id + real
-- current title, resolved fresh each read -- never a copied/stale
-- snapshot) so Lilica Chat itself can show a small "Re: <title>" chip.
-- Postgres refuses CREATE OR REPLACE when a RETURNS TABLE signature
-- gains columns -- drop first, same as any other "OUT parameters
-- changed" case.
-- ---------------------------------------------------------------------

drop function public.list_chat_messages(uuid, timestamptz, integer);

create function public.list_chat_messages(
  target_thread_id uuid,
  before_created_at timestamptz default null,
  page_size integer default 30
)
returns table (
  id uuid,
  thread_id uuid,
  sender_membership_id uuid,
  sender_display_name text,
  sender_is_former boolean,
  sender_is_self boolean,
  body text,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  subject_record_id uuid,
  subject_record_title text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_thread public.chat_threads%rowtype;
  caller_membership_id uuid;
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

  return query
  select
    m.id, m.thread_id, m.sender_membership_id,
    case when mm.membership_status = 'former' then coalesce(mm.former_display_name, 'Former member')
         else coalesce(p.display_name, 'A Lilica member') end,
    mm.membership_status = 'former',
    m.sender_membership_id = caller_membership_id,
    m.body, m.created_at, m.edited_at, m.deleted_at,
    m.subject_record_id,
    sr.record_data->>'title'
  from public.chat_messages m
  left join public.care_space_memberships mm on mm.id = m.sender_membership_id
  left join public.profiles p on p.id = mm.user_id
  left join public.records sr on sr.id = m.subject_record_id
  where m.thread_id = target_thread_id
    and (before_created_at is null or m.created_at < before_created_at)
  order by m.created_at desc
  limit greatest(1, least(coalesce(page_size, 30), 100));
end;
$$;

revoke all on function public.list_chat_messages(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.list_chat_messages(uuid, timestamptz, integer) to authenticated;

-- ---------------------------------------------------------------------
-- list_record_conversation: a record's full conversation -- its own
-- dedicated record-thread messages (if any) UNIONed with any Lilica Chat
-- messages tagged with it as their subject, newest first. Same
-- permission gate as get_or_create_record_thread/get_record_thread_info
-- (the record's own domain-read access) -- a direct message can never
-- reach here at all (subject_record_id is enforced care_circle-only at
-- send time), so no separate DM-privacy check is needed.
-- ---------------------------------------------------------------------

create function public.list_record_conversation(
  target_record_id uuid,
  before_created_at timestamptz default null,
  page_size integer default 30
)
returns table (
  id uuid,
  thread_id uuid,
  sender_membership_id uuid,
  sender_display_name text,
  sender_is_former boolean,
  sender_is_self boolean,
  body text,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  via_lilica_chat boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_record public.records%rowtype;
  record_domain text;
  caller_membership_id uuid;
  record_thread_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target_record from public.records where id = target_record_id;
  if not found then
    raise exception 'Record not found' using errcode = '42501';
  end if;

  record_domain := public.record_domain_for_type(target_record.record_type);
  if not public.can_access_care_space_records(target_record.care_space_id, record_domain, 'read') then
    raise exception 'Insufficient permission for this record domain' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_record.care_space_id);

  select ct.id into record_thread_id from public.chat_threads ct where ct.record_id = target_record_id and ct.kind = 'record';

  return query
  with combined as (
    select m.id, m.thread_id, m.sender_membership_id, m.body, m.created_at, m.edited_at, m.deleted_at,
           (record_thread_id is not null and m.thread_id = record_thread_id) as row_via_thread
    from public.chat_messages m
    where (record_thread_id is not null and m.thread_id = record_thread_id)
       or m.subject_record_id = target_record_id
  )
  select
    c.id, c.thread_id, c.sender_membership_id,
    case when mm.membership_status = 'former' then coalesce(mm.former_display_name, 'Former member')
         else coalesce(p.display_name, 'A Lilica member') end,
    mm.membership_status = 'former',
    c.sender_membership_id = caller_membership_id,
    c.body, c.created_at, c.edited_at, c.deleted_at,
    not c.row_via_thread
  from combined c
  left join public.care_space_memberships mm on mm.id = c.sender_membership_id
  left join public.profiles p on p.id = mm.user_id
  where before_created_at is null or c.created_at < before_created_at
  order by c.created_at desc
  limit greatest(1, least(coalesce(page_size, 30), 100));
end;
$$;

revoke all on function public.list_record_conversation(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.list_record_conversation(uuid, timestamptz, integer) to authenticated;

comment on function public.list_record_conversation(uuid, timestamptz, integer) is
  'Phase 23 slice 4: a record''s full conversation -- its own dedicated thread plus any Lilica Chat messages tagged with it as subject, merged newest-first.';

-- ---------------------------------------------------------------------
-- get_record_thread_info: message_count now reflects the same merged
-- total list_record_conversation would show, not just the dedicated
-- thread -- "View conversation (N)" should never undercount.
-- ---------------------------------------------------------------------

create or replace function public.get_record_thread_info(target_record_id uuid)
returns table (thread_id uuid, message_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_record public.records%rowtype;
  record_domain text;
  found_thread_id uuid;
  total_count integer;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target_record from public.records where id = target_record_id;
  if not found then
    raise exception 'Record not found' using errcode = '42501';
  end if;

  record_domain := public.record_domain_for_type(target_record.record_type);
  if not public.can_access_care_space_records(target_record.care_space_id, record_domain, 'read') then
    raise exception 'Insufficient permission for this record domain' using errcode = '42501';
  end if;

  select ct.id into found_thread_id from public.chat_threads ct where ct.record_id = target_record_id and ct.kind = 'record';

  select count(*) into total_count
  from public.chat_messages cm
  where cm.deleted_at is null
    and ((found_thread_id is not null and cm.thread_id = found_thread_id) or cm.subject_record_id = target_record_id);

  if total_count = 0 then
    return;
  end if;

  return query select found_thread_id, total_count;
end;
$$;
