-- Rename a supported person (20 September 2026, direct product-owner
-- request: no way to change a supported person's name after initial
-- setup existed anywhere in the app or schema -- confirmed by grep
-- before writing this). Same authority level and shape as
-- archive_care_space()/restore_care_space()
-- (20260915090000_phase20d_lifecycle_and_documents.sql): any active
-- organiser of the care space, idempotent-safe (a no-op rename is a
-- harmless success, never an error), logs activity exactly like every
-- other care-space mutation. supported_people.display_name already
-- carries the length constraint (1-80 trimmed chars) this reuses --
-- see 20260910090000_multi_person_care_spaces.sql.

-- care_space_activity's event_type is a closed list (care_space_activity_
-- event_type, most recently redefined in 20260915090000_phase20d_
-- lifecycle_and_documents.sql), not free text -- must grow it here using
-- the exact same drop-and-recreate technique that migration itself used,
-- or log_care_space_activity()'s insert below fails its CHECK constraint.
alter table public.care_space_activity drop constraint care_space_activity_event_type;
alter table public.care_space_activity add constraint care_space_activity_event_type check (event_type in (
  'record_created', 'record_completed', 'record_reopened',
  'assignment_changed', 'date_changed', 'document_uploaded',
  'member_joined', 'member_left', 'member_removed',
  'care_space_archived', 'care_space_restored', 'organiser_role_granted',
  'supported_person_renamed'
));

create function public.rename_supported_person(target_care_space_id uuid, new_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership public.care_space_memberships%rowtype;
  trimmed_name text := btrim(new_display_name);
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(trimmed_name) < 1 or char_length(trimmed_name) > 80 then
    raise exception 'Name must be between 1 and 80 characters' using errcode = '22023';
  end if;

  select * into caller_membership
  from public.care_space_memberships
  where care_space_id = target_care_space_id
    and user_id = (select auth.uid())
    and membership_status = 'active'
    and role = 'organiser';

  if not found then
    raise exception 'Only an active organiser of this care space can rename it' using errcode = '42501';
  end if;

  update public.supported_people
  set display_name = trimmed_name, updated_at = statement_timestamp()
  where care_space_id = target_care_space_id;

  perform public.log_care_space_activity(
    target_care_space_id, caller_membership.id, 'supported_person_renamed', null, 'general',
    jsonb_build_object('title', trimmed_name)
  );
end;
$$;

revoke all on function public.rename_supported_person(uuid, text) from public, anon;
grant execute on function public.rename_supported_person(uuid, text) to authenticated;
