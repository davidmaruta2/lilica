-- Phase 23 (slice 1): Lilica Chat -- the shared Care Circle conversation
-- thread. Scoped down from the full brief (docs\LILICA_CHAT_SCOPE... on
-- David's machine) to the core, real, working piece first: one shared
-- thread per care space, real persisted messages, edit/delete of your own
-- message, and an unread count for the People/Care Circle page's Chat card
-- and the bottom tab badge. Direct messages, record-linked threads, photo
-- attachments, read receipts and typing indicators are a deliberately
-- separate next slice -- `kind` is already a check constraint (not a plain
-- boolean) so extending it later, exactly like medical_log widened
-- records_type, needs no redesign of what is built here.
--
-- No domain concept applies to chat the way it does to records (health/
-- financial/home/documents) -- a Care Circle conversation is not
-- per-domain sensitive in that sense, so this reuses the plain membership
-- check (is_care_space_member/active_care_space_membership_id, both from
-- 20260910150000_phase7_records.sql) rather than
-- can_access_care_space_records(), which is a records-table-specific
-- concept.

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  kind text not null default 'care_circle',
  created_at timestamptz not null default statement_timestamp(),
  constraint chat_threads_kind check (kind in ('care_circle')),
  -- At most one shared Care Circle thread per care space -- get_or_create
  -- below relies on this to make its own get-or-create race-safe.
  constraint chat_threads_one_care_circle_per_space unique (care_space_id, kind)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete restrict,
  -- Denormalised from the thread for RLS/index efficiency -- exactly the
  -- same reasoning care_space_activity.record_domain copies at insert time
  -- rather than joining every read back to the thread/care space.
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  sender_membership_id uuid not null references public.care_space_memberships (id) on delete restrict,
  body text,
  created_at timestamptz not null default statement_timestamp(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint chat_messages_body_or_deleted check (
    (deleted_at is null and body is not null and char_length(btrim(body)) between 1 and 4000)
    or (deleted_at is not null and body is null)
  )
);

create table public.chat_thread_reads (
  thread_id uuid not null references public.chat_threads (id) on delete restrict,
  membership_id uuid not null references public.care_space_memberships (id) on delete restrict,
  last_read_at timestamptz not null default statement_timestamp(),
  primary key (thread_id, membership_id)
);

create index chat_messages_thread_created_idx on public.chat_messages (thread_id, created_at desc);
create index chat_threads_care_space_idx on public.chat_threads (care_space_id);

alter table public.chat_threads enable row level security;
alter table public.chat_threads force row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_messages force row level security;
alter table public.chat_thread_reads enable row level security;
alter table public.chat_thread_reads force row level security;

revoke all on table public.chat_threads from anon, authenticated;
revoke all on table public.chat_messages from anon, authenticated;
revoke all on table public.chat_thread_reads from anon, authenticated;
grant select on table public.chat_threads to authenticated;
grant select on table public.chat_messages to authenticated;
grant select on table public.chat_thread_reads to authenticated;

-- All writes go through the security-definer RPCs below -- no insert/
-- update/delete grant on any of these three tables, matching
-- care_space_activity's own immutable-from-the-client convention.

create policy "active members can read their care space's chat threads"
on public.chat_threads for select to authenticated
using (public.is_care_space_member(care_space_id));

create policy "active members can read their care space's chat messages"
on public.chat_messages for select to authenticated
using (public.is_care_space_member(care_space_id));

create policy "members can read only their own read markers"
on public.chat_thread_reads for select to authenticated
using (membership_id = public.active_care_space_membership_id(
  (select t.care_space_id from public.chat_threads t where t.id = thread_id)
));

comment on table public.chat_threads is 'Phase 23 slice 1: one shared Care Circle conversation thread per care space (kind = care_circle only, for now).';
comment on table public.chat_messages is 'Phase 23 slice 1: messages in a chat thread. Edited in place (edited_at set) or soft-deleted (deleted_at set, body cleared) by their own sender only, both via RPC.';
comment on table public.chat_thread_reads is 'Phase 23 slice 1: per-member last-read watermark per thread, driving the People/Care Circle Chat card and tab badge unread counts.';

-- ---------------------------------------------------------------------
-- get_or_create_care_circle_thread: idempotent by the unique constraint
-- above -- a race between two members opening chat for the first time at
-- the same moment resolves to the same single thread row (ON CONFLICT),
-- never two.
-- ---------------------------------------------------------------------

create function public.get_or_create_care_circle_thread(target_care_space_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_thread_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_care_space_member(target_care_space_id) then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  insert into public.chat_threads (care_space_id, kind)
  values (target_care_space_id, 'care_circle')
  on conflict (care_space_id, kind) do nothing;

  select id into found_thread_id
  from public.chat_threads
  where care_space_id = target_care_space_id and kind = 'care_circle';

  return found_thread_id;
end;
$$;

revoke all on function public.get_or_create_care_circle_thread(uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_care_circle_thread(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- send_chat_message: the only way a message row is ever created.
-- ---------------------------------------------------------------------

create function public.send_chat_message(target_thread_id uuid, message_body text)
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
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target_thread from public.chat_threads where id = target_thread_id;
  if not found then
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

  insert into public.chat_messages (thread_id, care_space_id, sender_membership_id, body)
  values (target_thread_id, target_thread.care_space_id, caller_membership_id, trimmed_body)
  returning * into result_message;

  -- Sending your own message also marks the thread read up to that point
  -- -- you have obviously seen everything up to and including what you
  -- just sent.
  insert into public.chat_thread_reads (thread_id, membership_id, last_read_at)
  values (target_thread_id, caller_membership_id, result_message.created_at)
  on conflict (thread_id, membership_id) do update
    set last_read_at = excluded.last_read_at
    where excluded.last_read_at > public.chat_thread_reads.last_read_at;

  return result_message;
end;
$$;

revoke all on function public.send_chat_message(uuid, text) from public, anon, authenticated;
grant execute on function public.send_chat_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- edit_chat_message / delete_chat_message: sender-only, enforced here
-- (not by RLS update/delete policies, since none exist on the table --
-- every write is centralised through these two RPCs, same as every other
-- mutation surface in this schema).
-- ---------------------------------------------------------------------

create function public.edit_chat_message(target_message_id uuid, new_body text)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_message public.chat_messages%rowtype;
  caller_membership_id uuid;
  trimmed_body text;
  result_message public.chat_messages%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into existing_message from public.chat_messages where id = target_message_id for update;
  if not found or existing_message.deleted_at is not null then
    raise exception 'Message not found' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(existing_message.care_space_id);
  if caller_membership_id is null or caller_membership_id <> existing_message.sender_membership_id then
    raise exception 'Only the sender can edit this message' using errcode = '42501';
  end if;

  trimmed_body := btrim(coalesce(new_body, ''));
  if char_length(trimmed_body) < 1 or char_length(trimmed_body) > 4000 then
    raise exception 'Message must be between 1 and 4000 characters' using errcode = '22023';
  end if;

  update public.chat_messages
  set body = trimmed_body, edited_at = statement_timestamp()
  where id = target_message_id
  returning * into result_message;

  return result_message;
end;
$$;

revoke all on function public.edit_chat_message(uuid, text) from public, anon, authenticated;
grant execute on function public.edit_chat_message(uuid, text) to authenticated;

create function public.delete_chat_message(target_message_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_message public.chat_messages%rowtype;
  caller_membership_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into existing_message from public.chat_messages where id = target_message_id for update;
  if not found or existing_message.deleted_at is not null then
    raise exception 'Message not found' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(existing_message.care_space_id);
  if caller_membership_id is null or caller_membership_id <> existing_message.sender_membership_id then
    raise exception 'Only the sender can delete this message' using errcode = '42501';
  end if;

  update public.chat_messages
  set deleted_at = statement_timestamp(), body = null
  where id = target_message_id;
end;
$$;

revoke all on function public.delete_chat_message(uuid) from public, anon, authenticated;
grant execute on function public.delete_chat_message(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- mark_chat_thread_read / get_chat_unread_count: drive the Chat card and
-- tab badge. get_chat_unread_count deliberately excludes the caller's own
-- messages (sending already marks the thread read up to that point, in
-- send_chat_message above, so this is belt-and-suspenders consistency,
-- not the only thing preventing your own messages counting as unread).
-- ---------------------------------------------------------------------

create function public.mark_chat_thread_read(target_thread_id uuid)
returns void
language plpgsql
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

  select * into target_thread from public.chat_threads where id = target_thread_id;
  if not found then
    raise exception 'Thread not found' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_thread.care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  insert into public.chat_thread_reads (thread_id, membership_id, last_read_at)
  values (target_thread_id, caller_membership_id, statement_timestamp())
  on conflict (thread_id, membership_id) do update
    set last_read_at = excluded.last_read_at;
end;
$$;

revoke all on function public.mark_chat_thread_read(uuid) from public, anon, authenticated;
grant execute on function public.mark_chat_thread_read(uuid) to authenticated;

create function public.get_chat_unread_count(target_care_space_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  target_thread_id uuid;
  last_read timestamptz;
  unread_count integer;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  select id into target_thread_id
  from public.chat_threads
  where care_space_id = target_care_space_id and kind = 'care_circle';

  if target_thread_id is null then
    return 0;
  end if;

  select last_read_at into last_read
  from public.chat_thread_reads
  where thread_id = target_thread_id and membership_id = caller_membership_id;

  select count(*) into unread_count
  from public.chat_messages
  where thread_id = target_thread_id
    and deleted_at is null
    and sender_membership_id <> caller_membership_id
    and created_at > coalesce(last_read, '-infinity'::timestamptz);

  return unread_count;
end;
$$;

revoke all on function public.get_chat_unread_count(uuid) from public, anon, authenticated;
grant execute on function public.get_chat_unread_count(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- list_chat_messages: paginated read, sender display name resolved the
-- same honest-provenance way list_recent_activity already does (a former
-- member's historical messages still show their real name via the
-- snapshot on the membership row, never "Unknown").
-- ---------------------------------------------------------------------

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
  deleted_at timestamptz
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

  select * into target_thread from public.chat_threads where id = target_thread_id;
  if not found then
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
    m.body, m.created_at, m.edited_at, m.deleted_at
  from public.chat_messages m
  left join public.care_space_memberships mm on mm.id = m.sender_membership_id
  left join public.profiles p on p.id = mm.user_id
  where m.thread_id = target_thread_id
    and (before_created_at is null or m.created_at < before_created_at)
  order by m.created_at desc
  limit greatest(1, least(coalesce(page_size, 30), 100));
end;
$$;

revoke all on function public.list_chat_messages(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.list_chat_messages(uuid, timestamptz, integer) to authenticated;
