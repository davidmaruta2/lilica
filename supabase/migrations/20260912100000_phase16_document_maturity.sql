-- Phase 16: Document Maturity.
--
-- Extends, rather than duplicates, the Phase 7/15 foundation: reuses
-- can_access_care_space_records()/record_domain_for_type() unchanged for
-- every new permission check below. Three additions:
--
--   * record_links: one canonical, typed, care-space-scoped relationship
--     table between any two records (RecordLink's shape, anticipated since
--     the original system contract, now actually persisted). Stored once,
--     queryable from either side -- see list_record_links().
--   * record_attachments: durable cloud-side attachment metadata (stable
--     id, owning record/care space, filename, mime/size, storage object
--     path, upload status) -- distinct from the existing device-local
--     `records.attachment_manifest` jsonb, which stays exactly as-is for
--     backward compatibility. See docs/PHASE_16_ARCHITECTURE.md for why
--     both now exist side by side.
--   * A new private Storage bucket (`document-attachments`) with RLS
--     mirroring the exact same domain-grant decision every record read/
--     write already goes through -- no second authorisation system.

-- ---------------------------------------------------------------------
-- 1. record_links.
-- ---------------------------------------------------------------------

create table public.record_links (
  id uuid primary key default gen_random_uuid(),
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  source_record_id uuid not null references public.records (id) on delete restrict,
  target_record_id uuid not null references public.records (id) on delete restrict,
  link_type text not null check (link_type in ('related_to', 'action_for')),
  created_by_membership_id uuid not null references public.care_space_memberships (id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz,
  constraint record_links_not_self check (source_record_id <> target_record_id)
);

-- Idempotent create: a retried/replayed create_record_link() for the same
-- (source, target, type) pair returns the existing row rather than a
-- second one, with no receipts table needed for this simpler, single-
-- owner-until-tombstoned relationship (unlike records, links are never
-- collaboratively field-merged).
create unique index record_links_unique_active
  on public.record_links (source_record_id, target_record_id, link_type)
  where deleted_at is null;

create index record_links_source_idx on public.record_links (source_record_id) where deleted_at is null;
create index record_links_target_idx on public.record_links (target_record_id) where deleted_at is null;

alter table public.record_links enable row level security;
alter table public.record_links force row level security;
revoke all on table public.record_links from anon, authenticated;
grant select on table public.record_links to authenticated;

-- No insert/update/delete policy: every write goes through the
-- security-definer functions below (matching care_space_domain_grants'
-- own precedent), so a mutation is always permission-checked and
-- idempotent, never a raw client-side table write.
--
-- Read visibility: a link is only visible to a caller who can currently
-- read BOTH sides' domains -- this is the server-side enforcement of
-- "must not be able to discover existence... of a linked record they are
-- not permitted to see" (Phase 16 brief section 12). A contributor who
-- can see the document but not the linked appointment's domain simply
-- never receives this row -- not a redacted row, no row at all.
create policy "members with visibility into both linked records can read the link"
on public.record_links for select to authenticated
using (
  exists (
    select 1 from public.records source_r
    where source_r.id = record_links.source_record_id
      and public.can_access_care_space_records(record_links.care_space_id, source_r.record_domain, 'read')
  )
  and exists (
    select 1 from public.records target_r
    where target_r.id = record_links.target_record_id
      and public.can_access_care_space_records(record_links.care_space_id, target_r.record_domain, 'read')
  )
);

create function public.create_record_link(
  target_care_space_id uuid,
  source_record_id uuid,
  target_record_id uuid,
  link_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  source_record public.records%rowtype;
  target_record public.records%rowtype;
  existing_link_id uuid;
  new_link_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  if link_type not in ('related_to', 'action_for') then
    raise exception 'Unsupported link type' using errcode = '22023';
  end if;

  if source_record_id = target_record_id then
    raise exception 'A record cannot be linked to itself' using errcode = '22023';
  end if;

  select * into source_record from public.records
    where id = source_record_id and care_space_id = target_care_space_id and deleted_at is null;
  if not found then
    raise exception 'Source record not found in this care space' using errcode = '42501';
  end if;

  select * into target_record from public.records
    where id = target_record_id and care_space_id = target_care_space_id and deleted_at is null;
  if not found then
    raise exception 'Target record not found in this care space' using errcode = '42501';
  end if;

  if not public.can_access_care_space_records(target_care_space_id, source_record.record_domain, 'write') then
    raise exception 'Insufficient permission to link this record' using errcode = '42501';
  end if;
  if not public.can_access_care_space_records(target_care_space_id, target_record.record_domain, 'read') then
    raise exception 'Insufficient permission to link to this record' using errcode = '42501';
  end if;

  select id into existing_link_id from public.record_links
    where record_links.source_record_id = create_record_link.source_record_id
      and record_links.target_record_id = create_record_link.target_record_id
      and record_links.link_type = create_record_link.link_type
      and deleted_at is null;
  if existing_link_id is not null then
    return existing_link_id;
  end if;

  insert into public.record_links (
    care_space_id, source_record_id, target_record_id, link_type, created_by_membership_id
  ) values (
    target_care_space_id, source_record_id, target_record_id, link_type, caller_membership_id
  )
  returning id into new_link_id;

  return new_link_id;
exception
  when unique_violation then
    select id into existing_link_id from public.record_links
      where record_links.source_record_id = create_record_link.source_record_id
        and record_links.target_record_id = create_record_link.target_record_id
        and record_links.link_type = create_record_link.link_type
        and deleted_at is null;
    return existing_link_id;
end;
$$;

revoke all on function public.create_record_link(uuid, uuid, uuid, text) from public;
revoke all on function public.create_record_link(uuid, uuid, uuid, text) from anon;
grant execute on function public.create_record_link(uuid, uuid, uuid, text) to authenticated;

create function public.remove_record_link(target_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.record_links%rowtype;
  source_record public.records%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into link_row from public.record_links where id = target_link_id and deleted_at is null;
  if not found then
    raise exception 'Link not found' using errcode = '42501';
  end if;

  select * into source_record from public.records where id = link_row.source_record_id;

  if not public.can_access_care_space_records(link_row.care_space_id, source_record.record_domain, 'write') then
    raise exception 'Insufficient permission to remove this link' using errcode = '42501';
  end if;

  update public.record_links set deleted_at = statement_timestamp() where id = target_link_id;
end;
$$;

revoke all on function public.remove_record_link(uuid) from public;
revoke all on function public.remove_record_link(uuid) from anon;
grant execute on function public.remove_record_link(uuid) to authenticated;

-- One stored relationship, queryable from either side (brief section 15):
-- pass the record you're viewing and get back every OTHER record it links
-- to/from, each already filtered to only what the caller may see.
create function public.list_record_links(target_record_id uuid)
returns table (
  link_id uuid,
  link_type text,
  direction text,
  other_record_id uuid,
  other_record_type text,
  other_record_title text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    link.id,
    link.link_type,
    case when link.source_record_id = list_record_links.target_record_id then 'outgoing' else 'incoming' end,
    other.id,
    other.record_type,
    other.record_data->>'title',
    link.created_at
  from public.record_links link
  join public.records anchor on anchor.id = list_record_links.target_record_id
  join public.records other
    on other.id = case
      when link.source_record_id = list_record_links.target_record_id then link.target_record_id
      else link.source_record_id
    end
  where link.deleted_at is null
    and other.deleted_at is null
    and (link.source_record_id = list_record_links.target_record_id or link.target_record_id = list_record_links.target_record_id)
    and anchor.care_space_id = link.care_space_id
    and public.can_access_care_space_records(link.care_space_id, anchor.record_domain, 'read')
    and public.can_access_care_space_records(link.care_space_id, other.record_domain, 'read')
  order by link.created_at desc;
$$;

revoke all on function public.list_record_links(uuid) from public;
revoke all on function public.list_record_links(uuid) from anon;
grant execute on function public.list_record_links(uuid) to authenticated;

comment on table public.record_links is 'Phase 16: one canonical typed relationship per pair, queryable from either side. Never grants access to either linked record -- see the read policy above.';

-- ---------------------------------------------------------------------
-- 2. record_attachments -- durable cloud-side attachment metadata.
-- ---------------------------------------------------------------------

create table public.record_attachments (
  id uuid primary key,
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  record_id uuid not null references public.records (id) on delete restrict,
  kind text not null check (kind in ('file', 'scan')),
  display_name text not null,
  mime_type text,
  size_bytes bigint,
  storage_object_path text not null unique,
  upload_status text not null default 'pending' check (upload_status in ('pending', 'uploaded', 'failed')),
  created_by_membership_id uuid not null references public.care_space_memberships (id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  deleted_at timestamptz
);

create index record_attachments_record_idx on public.record_attachments (record_id) where deleted_at is null;

alter table public.record_attachments enable row level security;
alter table public.record_attachments force row level security;
revoke all on table public.record_attachments from anon, authenticated;
grant select on table public.record_attachments to authenticated;

create policy "members with domain read access can list attachments"
on public.record_attachments for select to authenticated
using (
  exists (
    select 1 from public.records r
    where r.id = record_attachments.record_id
      and r.care_space_id = record_attachments.care_space_id
      and public.can_access_care_space_records(record_attachments.care_space_id, r.record_domain, 'read')
  )
);

-- Client-generated stable id (matches records.id's own pattern), so a
-- lost-acknowledgement retry re-sends the identical id and this upsert
-- converges rather than creating a duplicate row (brief section 6/17).
-- Metadata alone -- never a signed URL, never file bytes.
create function public.upsert_record_attachment(
  attachment_id uuid,
  target_record_id uuid,
  target_care_space_id uuid,
  attachment_kind text,
  attachment_display_name text,
  attachment_mime_type text,
  attachment_size_bytes bigint,
  attachment_storage_object_path text
)
returns public.record_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  target_record public.records%rowtype;
  result_row public.record_attachments%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  if attachment_kind not in ('file', 'scan') then
    raise exception 'Unsupported attachment kind' using errcode = '22023';
  end if;

  select * into target_record from public.records
    where id = target_record_id and care_space_id = target_care_space_id and deleted_at is null;
  if not found then
    raise exception 'Record not found in this care space' using errcode = '42501';
  end if;

  if not public.can_access_care_space_records(target_care_space_id, target_record.record_domain, 'write') then
    raise exception 'Insufficient permission for this record domain' using errcode = '42501';
  end if;

  insert into public.record_attachments (
    id, care_space_id, record_id, kind, display_name, mime_type, size_bytes,
    storage_object_path, created_by_membership_id
  ) values (
    attachment_id, target_care_space_id, target_record_id, attachment_kind, attachment_display_name,
    attachment_mime_type, attachment_size_bytes, attachment_storage_object_path, caller_membership_id
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    mime_type = excluded.mime_type,
    size_bytes = excluded.size_bytes,
    updated_at = statement_timestamp()
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.upsert_record_attachment(uuid, uuid, uuid, text, text, text, bigint, text) from public;
revoke all on function public.upsert_record_attachment(uuid, uuid, uuid, text, text, text, bigint, text) from anon;
grant execute on function public.upsert_record_attachment(uuid, uuid, uuid, text, text, text, bigint, text) to authenticated;

create function public.mark_attachment_upload_status(target_attachment_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attachment_row public.record_attachments%rowtype;
  owning_record public.records%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if new_status not in ('pending', 'uploaded', 'failed') then
    raise exception 'Unsupported upload status' using errcode = '22023';
  end if;

  select * into attachment_row from public.record_attachments where id = target_attachment_id and deleted_at is null;
  if not found then
    raise exception 'Attachment not found' using errcode = '42501';
  end if;

  select * into owning_record from public.records where id = attachment_row.record_id;

  if not public.can_access_care_space_records(attachment_row.care_space_id, owning_record.record_domain, 'write') then
    raise exception 'Insufficient permission for this record domain' using errcode = '42501';
  end if;

  update public.record_attachments
  set upload_status = new_status, updated_at = statement_timestamp()
  where id = target_attachment_id;
end;
$$;

revoke all on function public.mark_attachment_upload_status(uuid, text) from public;
revoke all on function public.mark_attachment_upload_status(uuid, text) from anon;
grant execute on function public.mark_attachment_upload_status(uuid, text) to authenticated;

create function public.remove_record_attachment(target_attachment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attachment_row public.record_attachments%rowtype;
  owning_record public.records%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into attachment_row from public.record_attachments where id = target_attachment_id and deleted_at is null;
  if not found then
    raise exception 'Attachment not found' using errcode = '42501';
  end if;

  select * into owning_record from public.records where id = attachment_row.record_id;

  if not public.can_access_care_space_records(attachment_row.care_space_id, owning_record.record_domain, 'write') then
    raise exception 'Insufficient permission for this record domain' using errcode = '42501';
  end if;

  update public.record_attachments set deleted_at = statement_timestamp() where id = target_attachment_id;
end;
$$;

revoke all on function public.remove_record_attachment(uuid) from public;
revoke all on function public.remove_record_attachment(uuid) from anon;
grant execute on function public.remove_record_attachment(uuid) to authenticated;

comment on table public.record_attachments is 'Phase 16: durable cloud-side attachment metadata only -- never a signed URL, never file bytes. See storage.objects policies below for the actual file boundary.';

-- ---------------------------------------------------------------------
-- 3. Private Storage bucket for document file bytes.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('document-attachments', 'document-attachments', false, 26214400)
on conflict (id) do nothing;

-- Path convention: "{care_space_id}/{record_id}/{attachment_id}-{safe
-- filename}" -- stable IDs identify ownership; the filename is preserved
-- only for human readability and is never itself a security boundary
-- (RLS below is what actually gates access, regardless of how guessable
-- a path is).
create function public.storage_object_care_space_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select nullif((storage.foldername(object_name))[1], '')::uuid;
$$;

revoke all on function public.storage_object_care_space_id(text) from public;
grant execute on function public.storage_object_care_space_id(text) to authenticated, anon;

create policy "document attachment bytes: read follows documents domain access"
on storage.objects for select to authenticated
using (
  bucket_id = 'document-attachments'
  and public.can_access_care_space_records(public.storage_object_care_space_id(name), 'documents', 'read')
);

create policy "document attachment bytes: upload follows documents domain access"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'document-attachments'
  and public.can_access_care_space_records(public.storage_object_care_space_id(name), 'documents', 'write')
);

create policy "document attachment bytes: update follows documents domain access"
on storage.objects for update to authenticated
using (
  bucket_id = 'document-attachments'
  and public.can_access_care_space_records(public.storage_object_care_space_id(name), 'documents', 'write')
)
with check (
  bucket_id = 'document-attachments'
  and public.can_access_care_space_records(public.storage_object_care_space_id(name), 'documents', 'write')
);

create policy "document attachment bytes: delete follows documents domain access"
on storage.objects for delete to authenticated
using (
  bucket_id = 'document-attachments'
  and public.can_access_care_space_records(public.storage_object_care_space_id(name), 'documents', 'write')
);
