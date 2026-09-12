-- Phase 18: Privacy, Settings, Export & Account Lifecycle.
--
-- Deliberately narrow: two new, read-only-in-effect RPCs, no new tables,
-- no new destructive capability, no change to any existing table/policy/
-- function. See docs/PHASE_18_ARCHITECTURE.md for why full account
-- (auth.users) deletion is NOT implemented in this migration -- a real,
-- investigated architectural blocker (care_space_memberships.user_id
-- references auth.users(id) ON DELETE RESTRICT, and membership rows are
-- themselves permanently ON DELETE RESTRICT-referenced from records/
-- occurrences/assignments/record_links/record_attachments/receipts, by
-- design, to preserve historical attribution) makes literal auth.users
-- deletion impossible today without either corrupting shared care-space
-- history or a separate, explicitly-approved schema change. This
-- migration instead ships the one safe, genuinely useful piece: a
-- precheck a client can call before ever offering "Delete account", so
-- the app never lies about whether deletion would even be possible.

-- ---------------------------------------------------------------------
-- 1. account_deletion_precheck(): read-only. Tells the caller whether
--    deleting their own account today would strand any care space (they
--    are its sole active organiser). Never deletes anything itself.
-- ---------------------------------------------------------------------

create function public.account_deletion_precheck()
returns table (
  care_space_id uuid,
  care_space_name text,
  blocking boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    membership.care_space_id,
    coalesce(person.display_name, 'A Lilica care space'),
    (
      select count(*) = 1
      from public.care_space_memberships organiser_count
      where organiser_count.care_space_id = membership.care_space_id
        and organiser_count.role = 'organiser'
        and organiser_count.membership_status = 'active'
    )
  from public.care_space_memberships membership
  left join public.supported_people person on person.care_space_id = membership.care_space_id
  where membership.user_id = (select auth.uid())
    and membership.membership_status = 'active'
    and membership.role = 'organiser'
  order by membership.created_at;
$$;

revoke all on function public.account_deletion_precheck() from public;
revoke all on function public.account_deletion_precheck() from anon;
grant execute on function public.account_deletion_precheck() to authenticated;

comment on function public.account_deletion_precheck() is
  'Phase 18: read-only sole-organiser check. Returns one row per care space the caller organises; blocking=true means they are its only active organiser -- deletion must be refused client-side until resolved. Deletes nothing.';

-- ---------------------------------------------------------------------
-- 2. export_my_data(): read-only. Returns a single jsonb document of
--    everything the CALLER is currently authorised to see, built through
--    the exact same domain-grant/RLS decision every other read already
--    goes through (membership_has_domain_access(), same as
--    can_access_care_space_records()) -- never a second permission
--    system, never more than the caller could already read one row at a
--    time via the normal app. A record_link is included only when BOTH
--    endpoints are individually visible to the caller (mirrors
--    record_links' own read policy exactly), so a restricted target's
--    title/id/existence never leaks through export either.
-- ---------------------------------------------------------------------

create function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid;
  profile_json jsonb;
  spaces_json jsonb;
begin
  caller_id := auth.uid();
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select to_jsonb(p) - 'id' into profile_json from public.profiles p where p.id = caller_id;

  select coalesce(jsonb_agg(space_export order by space_export->>'careSpaceName'), '[]'::jsonb)
  into spaces_json
  from (
    select jsonb_build_object(
      'careSpaceName', coalesce(person.display_name, 'A Lilica care space'),
      'yourRole', membership.role,
      'yourGrantedDomains', coalesce(
        array(select grant_row.domain from public.care_space_domain_grants grant_row where grant_row.membership_id = membership.id),
        '{}'
      ),
      'records', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id,
          'type', r.record_type,
          'data', r.record_data,
          'createdAt', r.created_at,
          'updatedAt', r.updated_at
        ) order by r.created_at), '[]'::jsonb)
        from public.records r
        where r.care_space_id = membership.care_space_id
          and r.deleted_at is null
          and public.membership_has_domain_access(membership.id, r.record_domain, 'read')
      ),
      'attachments', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id,
          'recordId', a.record_id,
          'displayName', a.display_name,
          'mimeType', a.mime_type,
          'sizeBytes', a.size_bytes,
          'uploadStatus', a.upload_status,
          'createdAt', a.created_at
        ) order by a.created_at), '[]'::jsonb)
        from public.record_attachments a
        join public.records r on r.id = a.record_id
        where a.care_space_id = membership.care_space_id
          and a.deleted_at is null
          and public.membership_has_domain_access(membership.id, r.record_domain, 'read')
      ),
      'recordLinks', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', l.id,
          'sourceRecordId', l.source_record_id,
          'targetRecordId', l.target_record_id,
          'linkType', l.link_type,
          'createdAt', l.created_at
        ) order by l.created_at), '[]'::jsonb)
        from public.record_links l
        join public.records source_r on source_r.id = l.source_record_id
        join public.records target_r on target_r.id = l.target_record_id
        where l.care_space_id = membership.care_space_id
          and l.deleted_at is null
          and public.membership_has_domain_access(membership.id, source_r.record_domain, 'read')
          and public.membership_has_domain_access(membership.id, target_r.record_domain, 'read')
      )
    ) as space_export
    from public.care_space_memberships membership
    left join public.supported_people person on person.care_space_id = membership.care_space_id
    where membership.user_id = caller_id
      and membership.membership_status = 'active'
  ) spaces;

  return jsonb_build_object(
    'generatedAt', to_jsonb(statement_timestamp()),
    'profile', coalesce(profile_json, 'null'::jsonb),
    'careSpaces', spaces_json
  );
end;
$$;

revoke all on function public.export_my_data() from public;
revoke all on function public.export_my_data() from anon;
grant execute on function public.export_my_data() to authenticated;

comment on function public.export_my_data() is
  'Phase 18: returns everything the caller is currently authorised to read, as one jsonb document -- metadata only for attachments (never file bytes, never a signed URL, never a Storage path). Filtered by the same membership_has_domain_access() every other read already uses; a record_link is included only when both endpoints pass that check individually, so a restricted target never leaks through export.';
