-- Phase 23 slice 3 lint fix: get_record_thread_info's RETURNS TABLE
-- declares an output column named `thread_id`, which the function body's
-- own final query then collided with (public.chat_messages.thread_id vs
-- the PL/pgSQL output variable) -- caught by `supabase db lint`
-- (sqlState 42702), same class of bug as 20260922120100's fix. Fixed by
-- qualifying the message-table column explicitly, same signature.

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
  if found_thread_id is null then
    return;
  end if;

  return query
  select found_thread_id, count(*)::integer from public.chat_messages cm where cm.thread_id = found_thread_id and cm.deleted_at is null;
end;
$$;
