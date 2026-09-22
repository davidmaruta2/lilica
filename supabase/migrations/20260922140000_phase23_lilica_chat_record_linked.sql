-- Phase 23 slice 3: Record-linked chat -- a conversation thread attached
-- to a single Medical Log item (careNote/condition/medicine, all mapped
-- to the health domain -- see record_domain_for_type()), so discussion
-- about one specific thing stays with that thing instead of mixing into
-- the general Lilica Chat.
--
-- Available on every Medical Log item, and always optional: nothing is
-- created just by viewing a record. get_record_thread_info() is a plain
-- read with no side effect (drives "Start a conversation" vs "View
-- conversation (N)"); get_or_create_record_thread() is the only thing
-- that ever creates the thread row, and even then no message exists
-- until send_chat_message() is actually called -- "lazily created on
-- first message" all the way down.
--
-- Access is gated by the SAME domain-grant decision the record itself
-- already uses (can_access_care_space_records with the record's own
-- domain), not plain care-space membership -- a contributor who was
-- never granted health-domain access cannot see or join a conversation
-- about a Medical Log item any more than they could open the item.

alter table public.chat_threads
  add column record_id uuid references public.records (id) on delete restrict;

alter table public.chat_threads drop constraint chat_threads_kind;
alter table public.chat_threads add constraint chat_threads_kind check (kind in ('care_circle', 'direct', 'record'));

alter table public.chat_threads drop constraint chat_threads_direct_members;
alter table public.chat_threads add constraint chat_threads_shape check (
  (kind = 'care_circle' and direct_member_a is null and direct_member_b is null and record_id is null)
  or (kind = 'direct' and direct_member_a is not null and direct_member_b is not null and direct_member_a < direct_member_b and record_id is null)
  or (kind = 'record' and record_id is not null and direct_member_a is null and direct_member_b is null)
);

create unique index chat_threads_record_idx on public.chat_threads (record_id) where kind = 'record';

comment on column public.chat_threads.record_id is 'Phase 23 slice 3: for kind=record only, the one record this conversation is about. One thread per record (unique index above), created lazily on first message.';

-- ---------------------------------------------------------------------
-- can_access_chat_thread: add the record branch. Every mutation/read RPC
-- (send/edit/delete/mark_read/list_chat_messages) already calls this
-- function rather than re-checking kind itself, so all of them gain
-- record-thread support with no further change below this point.
-- ---------------------------------------------------------------------

create or replace function public.can_access_chat_thread(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chat_threads t
    left join public.records r on r.id = t.record_id
    where t.id = target_thread_id
      and (
        (t.kind = 'care_circle' and public.is_care_space_member(t.care_space_id))
        or (t.kind = 'direct' and exists (
          select 1 from public.care_space_memberships m
          where m.care_space_id = t.care_space_id
            and m.user_id = (select auth.uid())
            and m.membership_status = 'active'
            and m.id in (t.direct_member_a, t.direct_member_b)
        ))
        or (t.kind = 'record' and r.id is not null and public.can_access_care_space_records(
          t.care_space_id, public.record_domain_for_type(r.record_type), 'read'
        ))
      )
  );
$$;

-- ---------------------------------------------------------------------
-- get_or_create_record_thread: the only thing that creates a 'record'
-- thread row. Refuses a deleted record (nothing new should attach to a
-- record that's gone, though existing conversation history on an
-- already-existing thread remains readable via can_access_chat_thread
-- above, which does not check deleted_at -- consistent with every other
-- "soft delete keeps history readable" convention in this schema).
-- ---------------------------------------------------------------------

create function public.get_or_create_record_thread(target_record_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_record public.records%rowtype;
  record_domain text;
  found_thread_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target_record from public.records where id = target_record_id;
  if not found or target_record.deleted_at is not null then
    raise exception 'Record not found' using errcode = '42501';
  end if;

  record_domain := public.record_domain_for_type(target_record.record_type);
  if not public.can_access_care_space_records(target_record.care_space_id, record_domain, 'read') then
    raise exception 'Insufficient permission for this record domain' using errcode = '42501';
  end if;

  insert into public.chat_threads (care_space_id, kind, record_id)
  values (target_record.care_space_id, 'record', target_record_id)
  on conflict (record_id) where kind = 'record' do nothing;

  select id into found_thread_id from public.chat_threads where record_id = target_record_id and kind = 'record';

  return found_thread_id;
end;
$$;

revoke all on function public.get_or_create_record_thread(uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_record_thread(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- get_record_thread_info: read-only, no side effect -- drives "Start a
-- conversation" (no row returned) vs "View conversation (N)" (a row,
-- with the real message count) without ever creating an empty thread
-- just because someone opened the record's detail view.
-- ---------------------------------------------------------------------

create function public.get_record_thread_info(target_record_id uuid)
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

  select id into found_thread_id from public.chat_threads where record_id = target_record_id and kind = 'record';
  if found_thread_id is null then
    return;
  end if;

  return query
  select found_thread_id, count(*)::integer from public.chat_messages where thread_id = found_thread_id and deleted_at is null;
end;
$$;

revoke all on function public.get_record_thread_info(uuid) from public, anon, authenticated;
grant execute on function public.get_record_thread_info(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- get_chat_unread_count: simplified to delegate entirely to
-- can_access_chat_thread rather than repeating its kind-branch logic --
-- this is what makes record-thread unread messages count towards the
-- Care Circle tab badge/Chat card with no further change here.
-- ---------------------------------------------------------------------

create or replace function public.get_chat_unread_count(target_care_space_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  unread_count integer;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  select count(*) into unread_count
  from public.chat_messages msg
  join public.chat_threads t on t.id = msg.thread_id
  left join public.chat_thread_reads r on r.thread_id = msg.thread_id and r.membership_id = caller_membership_id
  where t.care_space_id = target_care_space_id
    and msg.deleted_at is null
    and msg.sender_membership_id <> caller_membership_id
    and msg.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    and public.can_access_chat_thread(t.id);

  return unread_count;
end;
$$;
