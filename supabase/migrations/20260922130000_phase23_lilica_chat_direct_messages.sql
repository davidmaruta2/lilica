-- Phase 23 slice 2: Direct messages -- a private one-to-one thread
-- between the signed-in member and exactly one other Care Circle member,
-- separate from the shared Lilica Chat thread (20260922120000/20260922120100).
--
-- A direct thread is identified by its two participants rather than a
-- separate membership table (chat_thread_members was scoped in the
-- original plan but is unnecessary for exactly-two-person DMs -- two
-- ordered columns plus a unique partial index give the same idempotent
-- get-or-create guarantee with less schema). direct_member_a is always
-- the lexicographically SMALLER of the two membership ids, so the same
-- pair always resolves to the same row regardless of who initiates.
--
-- Access to a 'direct' thread is participant-only, NOT "any active member
-- of the care space" (unlike the shared care_circle thread) -- a third
-- member who is otherwise a full organiser still cannot read someone
-- else's private conversation. can_access_chat_thread() centralises that
-- distinction so every table/RPC applies it identically, rather than
-- repeating the kind-branch logic in six places.

alter table public.chat_threads
  add column direct_member_a uuid references public.care_space_memberships (id) on delete restrict,
  add column direct_member_b uuid references public.care_space_memberships (id) on delete restrict;

alter table public.chat_threads drop constraint chat_threads_kind;
alter table public.chat_threads add constraint chat_threads_kind check (kind in ('care_circle', 'direct'));

alter table public.chat_threads add constraint chat_threads_direct_members check (
  (kind = 'direct' and direct_member_a is not null and direct_member_b is not null and direct_member_a < direct_member_b)
  or (kind <> 'direct' and direct_member_a is null and direct_member_b is null)
);

create unique index chat_threads_direct_pair_idx
  on public.chat_threads (care_space_id, direct_member_a, direct_member_b)
  where kind = 'direct';

comment on column public.chat_threads.direct_member_a is 'Phase 23 slice 2: for kind=direct only, the lexicographically smaller of the two participant membership ids -- canonicalises the pair so get_or_create_direct_thread is idempotent regardless of who starts it.';
comment on column public.chat_threads.direct_member_b is 'Phase 23 slice 2: for kind=direct only, the lexicographically larger of the two participant membership ids.';

-- ---------------------------------------------------------------------
-- can_access_chat_thread: the one place both "is this a care_circle
-- thread any active member can read" and "is this a direct thread I am
-- one of the two participants of" are decided. Used by chat_threads'
-- and chat_messages' own SELECT policies below, and by every mutation
-- RPC (replacing their previous is_care_space_member-only check, which
-- was correct for the care_circle-only world of slice 1 but would let
-- any care-space member read or post into someone else's DM).
-- ---------------------------------------------------------------------

create function public.can_access_chat_thread(target_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chat_threads t
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
      )
  );
$$;

revoke all on function public.can_access_chat_thread(uuid) from public;
grant execute on function public.can_access_chat_thread(uuid) to authenticated;

drop policy "active members can read their care space's chat threads" on public.chat_threads;
create policy "members can read chat threads they can access"
on public.chat_threads for select to authenticated
using (public.can_access_chat_thread(id));

drop policy "active members can read their care space's chat messages" on public.chat_messages;
create policy "members can read messages in threads they can access"
on public.chat_messages for select to authenticated
using (public.can_access_chat_thread(thread_id));

-- ---------------------------------------------------------------------
-- get_or_create_direct_thread: idempotent by the unique partial index
-- above. Refuses a thread with yourself, and refuses a partner who is
-- not a genuine active member of the same care space (never a Key
-- contact, never a former/revoked member).
-- ---------------------------------------------------------------------

create function public.get_or_create_direct_thread(target_care_space_id uuid, other_membership_id uuid)
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

  insert into public.chat_threads (care_space_id, kind, direct_member_a, direct_member_b)
  values (target_care_space_id, 'direct', member_a, member_b)
  on conflict (care_space_id, direct_member_a, direct_member_b) where kind = 'direct' do nothing;

  select id into found_thread_id
  from public.chat_threads
  where care_space_id = target_care_space_id and kind = 'direct'
    and direct_member_a = member_a and direct_member_b = member_b;

  return found_thread_id;
end;
$$;

revoke all on function public.get_or_create_direct_thread(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_direct_thread(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Redefine the slice-1 mutation/read RPCs to use can_access_chat_thread
-- instead of "any active member of this care space" -- same signatures,
-- only the access check inside changes.
-- ---------------------------------------------------------------------

create or replace function public.send_chat_message(target_thread_id uuid, message_body text)
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

  insert into public.chat_messages (thread_id, care_space_id, sender_membership_id, body)
  values (target_thread_id, target_thread.care_space_id, caller_membership_id, trimmed_body)
  returning * into result_message;

  insert into public.chat_thread_reads (thread_id, membership_id, last_read_at)
  values (target_thread_id, caller_membership_id, result_message.created_at)
  on conflict (thread_id, membership_id) do update
    set last_read_at = excluded.last_read_at
    where excluded.last_read_at > public.chat_thread_reads.last_read_at;

  return result_message;
end;
$$;

create or replace function public.edit_chat_message(target_message_id uuid, new_body text)
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
  if not found or existing_message.deleted_at is not null or not public.can_access_chat_thread(existing_message.thread_id) then
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

create or replace function public.delete_chat_message(target_message_id uuid)
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
  if not found or existing_message.deleted_at is not null or not public.can_access_chat_thread(existing_message.thread_id) then
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

create or replace function public.mark_chat_thread_read(target_thread_id uuid)
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

  select ct.* into target_thread from public.chat_threads ct where ct.id = target_thread_id;
  if not found or not public.can_access_chat_thread(target_thread_id) then
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

create or replace function public.list_chat_messages(
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

-- ---------------------------------------------------------------------
-- get_chat_unread_count: now sums across EVERY thread the caller can
-- access in this care space (the shared thread plus every direct thread
-- they're a participant of), not only the single care_circle thread --
-- this is what feeds the Care Circle tab badge and the Chat card, both
-- of which should reflect direct messages too.
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
    and (
      (t.kind = 'care_circle')
      or (t.kind = 'direct' and caller_membership_id in (t.direct_member_a, t.direct_member_b))
    );

  return unread_count;
end;
$$;

-- ---------------------------------------------------------------------
-- list_my_direct_threads: every direct thread the caller is a
-- participant of in this care space, with the other participant's real
-- display name (honest-provenance, same former-member handling as
-- list_chat_messages) and a per-thread unread count -- drives a future
-- "Direct messages" list; the MVP entry point (MemberDetailPopup's
-- "Message privately") only needs get_or_create_direct_thread, but a
-- read like this is needed the first time someone wants to see who
-- they've already messaged, so it ships in the same slice.
-- ---------------------------------------------------------------------

create function public.list_my_direct_threads(target_care_space_id uuid)
returns table (
  thread_id uuid,
  other_membership_id uuid,
  other_display_name text,
  other_is_former boolean,
  unread_count integer,
  last_message_at timestamptz
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

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  return query
  with rows as (
    select
      t.id as row_thread_id,
      other.id as row_other_membership_id,
      case when other.membership_status = 'former' then coalesce(other.former_display_name, 'Former member')
           else coalesce(p.display_name, 'A Lilica member') end as row_other_display_name,
      (other.membership_status = 'former') as row_other_is_former,
      coalesce((
        select count(*) from public.chat_messages msg
        left join public.chat_thread_reads r on r.thread_id = t.id and r.membership_id = caller_membership_id
        where msg.thread_id = t.id
          and msg.deleted_at is null
          and msg.sender_membership_id <> caller_membership_id
          and msg.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
      ), 0)::integer as row_unread_count,
      (select max(msg.created_at) from public.chat_messages msg where msg.thread_id = t.id) as row_last_message_at
    from public.chat_threads t
    join public.care_space_memberships other
      on other.id = (case when t.direct_member_a = caller_membership_id then t.direct_member_b else t.direct_member_a end)
    left join public.profiles p on p.id = other.user_id
    where t.care_space_id = target_care_space_id
      and t.kind = 'direct'
      and caller_membership_id in (t.direct_member_a, t.direct_member_b)
  )
  select row_thread_id, row_other_membership_id, row_other_display_name, row_other_is_former, row_unread_count, row_last_message_at
  from rows
  order by row_last_message_at desc nulls last;
end;
$$;

revoke all on function public.list_my_direct_threads(uuid) from public, anon, authenticated;
grant execute on function public.list_my_direct_threads(uuid) to authenticated;
