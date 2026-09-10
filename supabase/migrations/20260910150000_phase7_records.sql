alter table public.care_space_memberships
  add column membership_status text not null default 'active',
  add constraint care_space_memberships_status
    check (membership_status in ('active', 'revoked'));

drop function public.list_my_supported_people();
create function public.list_my_supported_people()
returns table (
  draft_id uuid,
  care_space_id uuid,
  supported_person_id uuid,
  membership_id uuid,
  display_name text,
  relationship_type text,
  relationship_label text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    membership.bootstrap_id,
    membership.care_space_id,
    person.id,
    membership.id,
    person.display_name,
    membership.relationship_type,
    membership.relationship_label
  from public.care_space_memberships membership
  join public.supported_people person on person.care_space_id = membership.care_space_id
  where membership.user_id = (select auth.uid())
    and membership.membership_status = 'active'
  order by membership.created_at, membership.id;
$$;

revoke all on function public.list_my_supported_people() from public;
revoke all on function public.list_my_supported_people() from anon;
grant execute on function public.list_my_supported_people() to authenticated;

create or replace function public.is_care_space_member(target_care_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_space_memberships membership
    where membership.care_space_id = target_care_space_id
      and membership.user_id = (select auth.uid())
      and membership.membership_status = 'active'
  );
$$;

create function public.active_care_space_membership_id(target_care_space_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.id
  from public.care_space_memberships membership
  where membership.care_space_id = target_care_space_id
    and membership.user_id = (select auth.uid())
    and membership.membership_status = 'active'
  limit 1;
$$;

create function public.record_domain_for_type(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case value
    when 'careNote' then 'health'
    when 'bill' then 'financial'
    when 'homeMatter' then 'home'
    when 'document' then 'documents'
    else 'general'
  end;
$$;

create function public.record_sensitivity_for_type(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when value in ('careNote', 'bill', 'document') then 'sensitive'
    else 'standard'
  end;
$$;

create function public.can_access_care_space_records(
  target_care_space_id uuid,
  target_domain text,
  requested_action text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_space_memberships membership
    where membership.care_space_id = target_care_space_id
      and membership.user_id = (select auth.uid())
      and membership.membership_status = 'active'
      and membership.role = 'organiser'
      and target_domain in ('general', 'health', 'financial', 'home', 'documents')
      and requested_action in ('read', 'write')
  );
$$;

revoke all on function public.active_care_space_membership_id(uuid) from public;
revoke all on function public.record_domain_for_type(text) from public;
revoke all on function public.record_sensitivity_for_type(text) from public;
revoke all on function public.can_access_care_space_records(uuid, text, text) from public;
grant execute on function public.active_care_space_membership_id(uuid) to authenticated;
grant execute on function public.can_access_care_space_records(uuid, text, text) to authenticated;

create sequence public.record_change_sequence_seq;
revoke all on sequence public.record_change_sequence_seq from public, anon, authenticated;

create table public.records (
  id uuid primary key,
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  local_record_id text not null,
  record_type text not null,
  record_data jsonb not null default '{}'::jsonb,
  record_domain text generated always as (public.record_domain_for_type(record_type)) stored,
  sensitivity text generated always as (public.record_sensitivity_for_type(record_type)) stored,
  lifecycle text not null default 'active',
  deleted_at timestamptz,
  legacy_responsibility_text text,
  responsibility_source text,
  attachment_manifest jsonb not null default '[]'::jsonb,
  source text not null,
  created_by_membership_id uuid not null references public.care_space_memberships (id) on delete restrict,
  updated_by_membership_id uuid not null references public.care_space_memberships (id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version integer not null default 1,
  change_sequence bigint not null default nextval('public.record_change_sequence_seq'),
  constraint records_space_local_id_unique unique (care_space_id, local_record_id),
  constraint records_type check (record_type in ('appointment', 'task', 'bill', 'homeMatter', 'document', 'contact', 'careNote', 'update')),
  constraint records_data_object check (jsonb_typeof(record_data) = 'object'),
  constraint records_lifecycle check (lifecycle in ('active', 'archived')),
  constraint records_responsibility_source check (
    (legacy_responsibility_text is null and responsibility_source is null)
    or (legacy_responsibility_text is not null and responsibility_source in ('legacy_local_record', 'native_free_text'))
  ),
  constraint records_attachment_manifest_array check (jsonb_typeof(attachment_manifest) = 'array'),
  constraint records_source check (source in ('native', 'phase1_import')),
  constraint records_version_positive check (version > 0)
);

create index records_care_space_change_idx on public.records (care_space_id, change_sequence);
create index records_care_space_domain_idx on public.records (care_space_id, record_domain, sensitivity);

create table public.record_mutation_receipts (
  operation_id uuid primary key,
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  record_id uuid not null references public.records (id) on delete restrict,
  actor_membership_id uuid not null references public.care_space_memberships (id) on delete restrict,
  mutation_kind text not null,
  result_version integer not null,
  result_change_sequence bigint not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint record_mutation_receipts_kind check (mutation_kind in ('create', 'import', 'update', 'delete'))
);

create index record_mutation_receipts_space_idx on public.record_mutation_receipts (care_space_id, created_at);

create function public.protect_record_identity_and_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id <> old.id
    or new.care_space_id <> old.care_space_id
    or new.local_record_id <> old.local_record_id
    or new.record_type <> old.record_type
    or new.source <> old.source
    or new.created_by_membership_id <> old.created_by_membership_id then
    raise exception 'Record ownership and source identifiers are immutable' using errcode = '42501';
  end if;

  new.created_at := old.created_at;
  new.updated_at := statement_timestamp();
  new.version := old.version + 1;
  new.change_sequence := nextval('public.record_change_sequence_seq');
  return new;
end;
$$;

revoke all on function public.protect_record_identity_and_version() from public;
create trigger records_protect_identity_and_version
before update on public.records
for each row execute function public.protect_record_identity_and_version();

alter table public.records enable row level security;
alter table public.records force row level security;
alter table public.record_mutation_receipts enable row level security;
alter table public.record_mutation_receipts force row level security;

revoke all on table public.records, public.record_mutation_receipts from anon, authenticated;
grant select on table public.records to authenticated;

create policy "active organisers can read authorised records"
on public.records for select to authenticated
using (public.can_access_care_space_records(care_space_id, record_domain, 'read'));

create function public.apply_record_mutation(
  operation_id uuid,
  target_record_id uuid,
  target_care_space_id uuid,
  mutation_kind text,
  base_version integer,
  mutation_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  existing_receipt public.record_mutation_receipts%rowtype;
  current_record public.records%rowtype;
  result_record public.records%rowtype;
  payload_type text;
  payload_local_id text;
  payload_data jsonb;
  payload_responsibility text;
  payload_attachments jsonb;
  base_data jsonb;
  base_responsibility text;
  base_attachments jsonb;
  merged_data jsonb;
  merged_responsibility text;
  merged_attachments jsonb;
  changed_key text;
  derived_source text;
  derived_responsibility_source text;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null
    or not public.can_access_care_space_records(target_care_space_id, 'general', 'write') then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  if mutation_kind not in ('create', 'import', 'update', 'delete') then
    raise exception 'Unsupported record mutation' using errcode = '22023';
  end if;

  select * into existing_receipt
  from public.record_mutation_receipts receipt
  where receipt.operation_id = apply_record_mutation.operation_id;

  if found then
    if existing_receipt.care_space_id <> target_care_space_id
      or existing_receipt.record_id <> target_record_id
      or existing_receipt.actor_membership_id <> caller_membership_id
      or existing_receipt.mutation_kind <> mutation_kind then
      raise exception 'Operation identity cannot be reused' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'status', 'duplicate',
      'version', existing_receipt.result_version,
      'change_sequence', existing_receipt.result_change_sequence
    );
  end if;

  if mutation_kind in ('create', 'import', 'update') then
    if mutation_payload is null or jsonb_typeof(mutation_payload) <> 'object' then
      raise exception 'Record payload must be an object' using errcode = '22023';
    end if;
    payload_type := mutation_payload->>'record_type';
    payload_local_id := mutation_payload->>'local_record_id';
    payload_data := mutation_payload->'record_data';
    payload_responsibility := nullif(mutation_payload->>'legacy_responsibility_text', '');
    payload_attachments := coalesce(mutation_payload->'attachment_manifest', '[]'::jsonb);
    base_data := mutation_payload->'base_record_data';
    base_responsibility := nullif(mutation_payload->>'base_legacy_responsibility_text', '');
    base_attachments := mutation_payload->'base_attachment_manifest';

    if payload_type not in ('appointment', 'task', 'bill', 'homeMatter', 'document', 'contact', 'careNote', 'update')
      or char_length(coalesce(payload_local_id, '')) < 1
      or jsonb_typeof(payload_data) <> 'object'
      or jsonb_typeof(payload_attachments) <> 'array' then
      raise exception 'Invalid record payload' using errcode = '22023';
    end if;
  end if;

  if mutation_kind in ('create', 'import') then
    if base_version <> 0 then
      return jsonb_build_object('status', 'conflict', 'reason', 'invalid_create_base');
    end if;

    select * into current_record from public.records where id = target_record_id for update;
    if found then
      return jsonb_build_object('status', 'conflict', 'reason', 'record_already_exists', 'version', current_record.version);
    end if;

    derived_source := case mutation_kind when 'import' then 'phase1_import' else 'native' end;
    derived_responsibility_source := case
      when payload_responsibility is null then null
      when mutation_kind = 'import' then 'legacy_local_record'
      else 'native_free_text'
    end;

    insert into public.records (
      id, care_space_id, local_record_id, record_type, record_data,
      legacy_responsibility_text, responsibility_source, attachment_manifest,
      source, created_by_membership_id, updated_by_membership_id
    ) values (
      target_record_id, target_care_space_id, payload_local_id, payload_type, payload_data,
      payload_responsibility, derived_responsibility_source, payload_attachments,
      derived_source, caller_membership_id, caller_membership_id
    ) returning * into result_record;
  else
    select * into current_record
    from public.records
    where id = target_record_id and care_space_id = target_care_space_id
    for update;

    if not found then
      return jsonb_build_object('status', 'conflict', 'reason', 'record_missing');
    end if;
    if current_record.deleted_at is not null then
      return jsonb_build_object('status', 'conflict', 'reason', 'record_deleted', 'version', current_record.version);
    end if;

    if mutation_kind = 'update' then
      if payload_type <> current_record.record_type or payload_local_id <> current_record.local_record_id then
        raise exception 'Record identity cannot be changed' using errcode = '42501';
      end if;
      merged_data := payload_data;
      merged_responsibility := payload_responsibility;
      merged_attachments := payload_attachments;

      if current_record.version <> base_version then
        if jsonb_typeof(base_data) <> 'object' or jsonb_typeof(base_attachments) <> 'array' then
          return jsonb_build_object('status', 'conflict', 'reason', 'stale_version', 'version', current_record.version);
        end if;
        merged_data := current_record.record_data;
        for changed_key in select key from jsonb_object_keys(payload_data || base_data) as key
        loop
          if payload_data->changed_key is distinct from base_data->changed_key
            or (payload_data ? changed_key) <> (base_data ? changed_key) then
            if current_record.record_data->changed_key is distinct from base_data->changed_key
              or (current_record.record_data ? changed_key) <> (base_data ? changed_key) then
              return jsonb_build_object('status', 'conflict', 'reason', 'same_field', 'field', changed_key, 'version', current_record.version);
            end if;
            if payload_data ? changed_key then
              merged_data := jsonb_set(merged_data, array[changed_key], payload_data->changed_key, true);
            else
              merged_data := merged_data - changed_key;
            end if;
          end if;
        end loop;
        if payload_responsibility is distinct from base_responsibility then
          if current_record.legacy_responsibility_text is distinct from base_responsibility then
            return jsonb_build_object('status', 'conflict', 'reason', 'same_field', 'field', 'legacy_responsibility_text', 'version', current_record.version);
          end if;
        else
          merged_responsibility := current_record.legacy_responsibility_text;
        end if;
        if payload_attachments is distinct from base_attachments then
          if current_record.attachment_manifest is distinct from base_attachments then
            return jsonb_build_object('status', 'conflict', 'reason', 'same_field', 'field', 'attachment_manifest', 'version', current_record.version);
          end if;
        else
          merged_attachments := current_record.attachment_manifest;
        end if;
      end if;

      derived_responsibility_source := case
        when merged_responsibility is null then null
        when current_record.responsibility_source = 'legacy_local_record'
          and merged_responsibility is not distinct from current_record.legacy_responsibility_text
          then 'legacy_local_record'
        else 'native_free_text'
      end;
      update public.records
      set record_data = merged_data,
          legacy_responsibility_text = merged_responsibility,
          responsibility_source = derived_responsibility_source,
          attachment_manifest = merged_attachments,
          updated_by_membership_id = caller_membership_id
      where id = target_record_id
      returning * into result_record;
    else
      if current_record.version <> base_version then
        return jsonb_build_object('status', 'conflict', 'reason', 'stale_version', 'version', current_record.version);
      end if;
      update public.records
      set deleted_at = statement_timestamp(),
          updated_by_membership_id = caller_membership_id
      where id = target_record_id
      returning * into result_record;
    end if;
  end if;

  insert into public.record_mutation_receipts (
    operation_id, care_space_id, record_id, actor_membership_id, mutation_kind,
    result_version, result_change_sequence
  ) values (
    operation_id, target_care_space_id, target_record_id, caller_membership_id, mutation_kind,
    result_record.version, result_record.change_sequence
  );

  return jsonb_build_object(
    'status', 'applied',
    'version', result_record.version,
    'change_sequence', result_record.change_sequence
  );
exception
  when unique_violation then
    select * into existing_receipt
    from public.record_mutation_receipts receipt
    where receipt.operation_id = apply_record_mutation.operation_id;
    if found
      and existing_receipt.care_space_id = target_care_space_id
      and existing_receipt.record_id = target_record_id
      and existing_receipt.actor_membership_id = caller_membership_id
      and existing_receipt.mutation_kind = mutation_kind then
      return jsonb_build_object(
        'status', 'duplicate',
        'version', existing_receipt.result_version,
        'change_sequence', existing_receipt.result_change_sequence
      );
    end if;
    return jsonb_build_object('status', 'conflict', 'reason', 'identity_collision');
end;
$$;

revoke all on function public.apply_record_mutation(uuid, uuid, uuid, text, integer, jsonb) from public;
revoke all on function public.apply_record_mutation(uuid, uuid, uuid, text, integer, jsonb) from anon;
grant execute on function public.apply_record_mutation(uuid, uuid, uuid, text, integer, jsonb) to authenticated;

comment on table public.records is 'Phase 7 durable care-space records. Occurrences and assignments are deliberately deferred.';
comment on column public.records.local_record_id is 'Stable device-era record identity retained during migration and reconstruction.';
comment on column public.records.legacy_responsibility_text is 'Descriptive responsibility text only; never an authenticated identity or permission.';
comment on column public.records.attachment_manifest is 'Metadata only. Attachment bytes and local URIs remain device-local in Phase 7.';
comment on function public.can_access_care_space_records(uuid, text, text) is 'Central Phase 7 record policy boundary; Phase 15 may extend grants without changing record ownership.';
