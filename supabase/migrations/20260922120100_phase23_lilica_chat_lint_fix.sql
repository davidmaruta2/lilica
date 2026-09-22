-- Phase 23 slice 1 lint fix: list_chat_messages's RETURNS TABLE declares an
-- output column named `id`, which the function body's own
-- `where id = target_thread_id` then collided with (chat_threads.id vs the
-- PL/pgSQL output variable id) -- caught by `supabase db lint`
-- (sqlState 42702, "column reference id is ambiguous") right after
-- 20260922120000 was applied, before anything depended on it. Fixed by
-- table-aliasing the lookup, same signature, no other behaviour change.

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
