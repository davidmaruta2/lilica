create function public.phase8_stable_uuid(seed text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  first_hash bigint := 2166136261;
  second_hash bigint := 2246822519;
  hex_value text;
begin
  for index_value in 1..char_length(seed) loop
    first_hash := mod(((first_hash # ascii(substr(seed, index_value, 1)))::numeric * 16777619), 4294967296)::bigint;
    second_hash := mod(((second_hash # ascii(substr(seed, index_value, 1)))::numeric * 3266489917), 4294967296)::bigint;
  end loop;
  hex_value := lpad(to_hex(first_hash), 8, '0') || lpad(to_hex(second_hash), 8, '0') || 'a5a5c3c3d4d4e6e6';
  return (
    substr(hex_value, 1, 8) || '-' || substr(hex_value, 9, 4) || '-4' || substr(hex_value, 14, 3)
    || '-a' || substr(hex_value, 18, 3) || '-' || substr(hex_value, 21, 12)
  )::uuid;
end;
$$;

create function public.phase8_json_date(data jsonb, keys text[])
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  key_value text;
  candidate text;
begin
  foreach key_value in array keys loop
    candidate := data->>key_value;
    if candidate ~ '^\d{4}-\d{2}-\d{2}$'
      and to_char(to_date(candidate, 'YYYY-MM-DD'), 'YYYY-MM-DD') = candidate then
      return candidate::date;
    end if;
  end loop;
  return null;
end;
$$;

create function public.phase8_json_time(data jsonb, keys text[])
returns time
language plpgsql
stable
set search_path = ''
as $$
declare
  key_value text;
  candidate text;
begin
  foreach key_value in array keys loop
    candidate := data->>key_value;
    if candidate ~ '^([01]\d|2[0-3]):[0-5]\d$' then return candidate::time; end if;
  end loop;
  return null;
end;
$$;

create function public.phase8_json_timestamptz(data jsonb, key_value text, fallback_value timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if data->>key_value is null then return fallback_value; end if;
  return (data->>key_value)::timestamptz;
exception when others then
  return fallback_value;
end;
$$;

create function public.phase8_recurrence_date(
  anchor_date date,
  frequency text,
  interval_value integer,
  sequence_value integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  select case frequency
    when 'week' then anchor_date + (7 * interval_value * sequence_value)
    when 'month' then (
      date_trunc('month', anchor_date) + make_interval(months => interval_value * sequence_value)
      + (least(extract(day from anchor_date)::integer,
          extract(day from (date_trunc('month', anchor_date) + make_interval(months => interval_value * sequence_value)
            + interval '1 month - 1 day'))::integer) - 1) * interval '1 day'
    )::date
    when 'year' then (
      date_trunc('year', anchor_date) + make_interval(years => interval_value * sequence_value)
      + (extract(month from anchor_date)::integer - 1) * interval '1 month'
      + (least(extract(day from anchor_date)::integer,
          extract(day from (date_trunc('month', date_trunc('year', anchor_date)
            + make_interval(years => interval_value * sequence_value)
            + (extract(month from anchor_date)::integer - 1) * interval '1 month')
            + interval '1 month - 1 day'))::integer) - 1) * interval '1 day'
    )::date
  end;
$$;

revoke all on function public.phase8_stable_uuid(text) from public;
revoke all on function public.phase8_json_date(jsonb, text[]) from public;
revoke all on function public.phase8_json_time(jsonb, text[]) from public;
revoke all on function public.phase8_json_timestamptz(jsonb, text, timestamptz) from public;
revoke all on function public.phase8_recurrence_date(date, text, integer, integer) from public;

alter table public.records
  add constraint records_id_care_space_unique unique (id, care_space_id);
alter table public.care_space_memberships
  add constraint care_space_memberships_id_space_unique unique (id, care_space_id);

create table public.recurrence_series (
  id uuid primary key,
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  record_id uuid not null,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint recurrence_series_record_unique unique (record_id),
  constraint recurrence_series_id_space_unique unique (id, care_space_id),
  constraint recurrence_series_record_space_fk foreign key (record_id, care_space_id)
    references public.records (id, care_space_id) on delete restrict,
  constraint recurrence_series_creator_space_fk foreign key (created_by_membership_id, care_space_id)
    references public.care_space_memberships (id, care_space_id) on delete restrict
);

create table public.recurrence_rules (
  id uuid primary key,
  series_id uuid not null,
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  record_id uuid not null,
  version integer not null,
  frequency text not null,
  interval_value integer not null,
  anchor_date date not null,
  effective_from date not null,
  state text not null default 'active',
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint recurrence_rules_series_version_unique unique (series_id, version),
  constraint recurrence_rules_id_space_unique unique (id, care_space_id),
  constraint recurrence_rules_series_space_fk foreign key (series_id, care_space_id)
    references public.recurrence_series (id, care_space_id) on delete restrict,
  constraint recurrence_rules_record_space_fk foreign key (record_id, care_space_id)
    references public.records (id, care_space_id) on delete restrict,
  constraint recurrence_rules_creator_space_fk foreign key (created_by_membership_id, care_space_id)
    references public.care_space_memberships (id, care_space_id) on delete restrict,
  constraint recurrence_rules_frequency check (frequency in ('week', 'month', 'year')),
  constraint recurrence_rules_interval check (interval_value > 0),
  constraint recurrence_rules_state check (state in ('active', 'paused', 'stopped'))
);

create table public.occurrences (
  id uuid primary key,
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  record_id uuid not null,
  occurrence_kind text not null,
  status text not null,
  timing_kind text not null,
  due_on date,
  starts_on date,
  starts_time time,
  timezone text,
  instant_at timestamptz,
  recurrence_series_id uuid,
  recurrence_rule_id uuid,
  sequence integer not null default 0,
  original_due_on date,
  original_starts_on date,
  original_starts_time time,
  record_snapshot jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  deleted_at timestamptz,
  source text not null,
  created_by_membership_id uuid not null,
  updated_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version integer not null default 1,
  change_sequence bigint not null default nextval('public.record_change_sequence_seq'),
  constraint occurrences_record_sequence_unique unique (record_id, sequence),
  constraint occurrences_id_space_unique unique (id, care_space_id),
  constraint occurrences_record_space_fk foreign key (record_id, care_space_id)
    references public.records (id, care_space_id) on delete restrict,
  constraint occurrences_series_space_fk foreign key (recurrence_series_id, care_space_id)
    references public.recurrence_series (id, care_space_id) on delete restrict,
  constraint occurrences_rule_space_fk foreign key (recurrence_rule_id, care_space_id)
    references public.recurrence_rules (id, care_space_id) on delete restrict,
  constraint occurrences_creator_space_fk foreign key (created_by_membership_id, care_space_id)
    references public.care_space_memberships (id, care_space_id) on delete restrict,
  constraint occurrences_updater_space_fk foreign key (updated_by_membership_id, care_space_id)
    references public.care_space_memberships (id, care_space_id) on delete restrict,
  constraint occurrences_kind check (occurrence_kind in ('action', 'event')),
  constraint occurrences_status check (status in ('open', 'scheduled', 'awaiting_confirmation', 'completed', 'cancelled', 'missed')),
  constraint occurrences_timing_kind check (timing_kind in ('date', 'local_datetime', 'instant')),
  constraint occurrences_timing_shape check (
    (timing_kind = 'date' and due_on is not null and starts_on is null and starts_time is null and instant_at is null)
    or (timing_kind = 'local_datetime' and due_on is null and starts_on is not null and starts_time is not null and timezone is not null and instant_at is null)
    or (timing_kind = 'instant' and due_on is null and starts_on is null and starts_time is null and instant_at is not null)
  ),
  constraint occurrences_recurrence_shape check (
    (recurrence_series_id is null and recurrence_rule_id is null and sequence = 0)
    or (recurrence_series_id is not null and recurrence_rule_id is not null and sequence >= 0)
  ),
  constraint occurrences_completed_shape check ((status = 'completed') = (completed_at is not null)),
  constraint occurrences_snapshot_object check (jsonb_typeof(record_snapshot) = 'object'),
  constraint occurrences_source check (source in ('native', 'phase1_import')),
  constraint occurrences_version_positive check (version > 0)
);

create index occurrences_space_change_idx on public.occurrences (care_space_id, change_sequence);
create index occurrences_space_status_date_idx on public.occurrences (care_space_id, status, due_on, starts_on);
create index occurrences_record_idx on public.occurrences (record_id, sequence);

create table public.occurrence_versions (
  occurrence_id uuid not null references public.occurrences (id) on delete restrict,
  version integer not null,
  snapshot jsonb not null,
  superseded_at timestamptz not null default statement_timestamp(),
  primary key (occurrence_id, version),
  constraint occurrence_versions_snapshot_object check (jsonb_typeof(snapshot) = 'object')
);

create table public.occurrence_mutation_receipts (
  operation_id uuid primary key,
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  occurrence_id uuid not null references public.occurrences (id) on delete restrict,
  actor_membership_id uuid not null,
  mutation_kind text not null,
  result_version integer not null,
  result_change_sequence bigint not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint occurrence_receipts_actor_space_fk foreign key (actor_membership_id, care_space_id)
    references public.care_space_memberships (id, care_space_id) on delete restrict,
  constraint occurrence_receipts_kind check (mutation_kind in ('complete', 'cancel', 'reopen', 'set_timing'))
);

create table public.care_space_contacts (
  id uuid primary key,
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  display_name text not null,
  relationship_or_role text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint care_space_contacts_id_space_unique unique (id, care_space_id),
  constraint care_space_contacts_name check (char_length(btrim(display_name)) between 1 and 100),
  constraint care_space_contacts_creator_space_fk foreign key (created_by_membership_id, care_space_id)
    references public.care_space_memberships (id, care_space_id) on delete restrict
);

create table public.assignments (
  id uuid primary key,
  operation_id uuid not null unique,
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  record_id uuid,
  occurrence_id uuid,
  assignee_type text not null,
  membership_id uuid,
  external_contact_id uuid,
  status text not null default 'assigned',
  display_name_snapshot text not null,
  assigned_by_membership_id uuid not null,
  assigned_at timestamptz not null default statement_timestamp(),
  accepted_at timestamptz,
  declined_at timestamptz,
  removed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint assignments_target_exactly_one check (num_nonnulls(record_id, occurrence_id) = 1),
  constraint assignments_assignee_exactly_one check (num_nonnulls(membership_id, external_contact_id) = 1),
  constraint assignments_assignee_shape check (
    (assignee_type = 'membership' and membership_id is not null and external_contact_id is null)
    or (assignee_type = 'external_contact' and external_contact_id is not null and membership_id is null)
  ),
  constraint assignments_status check (status in ('assigned', 'accepted', 'declined', 'removed', 'completed')),
  constraint assignments_snapshot check (char_length(btrim(display_name_snapshot)) between 1 and 100),
  constraint assignments_record_space_fk foreign key (record_id, care_space_id)
    references public.records (id, care_space_id) on delete restrict,
  constraint assignments_occurrence_space_fk foreign key (occurrence_id, care_space_id)
    references public.occurrences (id, care_space_id) on delete restrict,
  constraint assignments_membership_space_fk foreign key (membership_id, care_space_id)
    references public.care_space_memberships (id, care_space_id) on delete restrict,
  constraint assignments_contact_space_fk foreign key (external_contact_id, care_space_id)
    references public.care_space_contacts (id, care_space_id) on delete restrict,
  constraint assignments_assigner_space_fk foreign key (assigned_by_membership_id, care_space_id)
    references public.care_space_memberships (id, care_space_id) on delete restrict
);

create index assignments_space_status_idx on public.assignments (care_space_id, status);
create index assignments_occurrence_idx on public.assignments (occurrence_id) where occurrence_id is not null;

create function public.protect_occurrence_identity_and_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id <> old.id or new.care_space_id <> old.care_space_id or new.record_id <> old.record_id
    or new.occurrence_kind <> old.occurrence_kind or new.sequence <> old.sequence
    or new.source <> old.source or new.created_by_membership_id <> old.created_by_membership_id then
    raise exception 'Occurrence ownership and source identifiers are immutable' using errcode = '42501';
  end if;
  insert into public.occurrence_versions (occurrence_id, version, snapshot)
  values (old.id, old.version, to_jsonb(old) - 'change_sequence')
  on conflict do nothing;
  new.created_at := old.created_at;
  new.updated_at := statement_timestamp();
  new.version := old.version + 1;
  new.change_sequence := nextval('public.record_change_sequence_seq');
  return new;
end;
$$;

revoke all on function public.protect_occurrence_identity_and_version() from public;
create trigger occurrences_protect_identity_and_version
before update on public.occurrences
for each row execute function public.protect_occurrence_identity_and_version();

create function public.phase8_sync_record_occurrence(record_row public.records)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule_date date;
  schedule_time time;
  occurrence_kind_value text;
  timing_kind_value text;
  status_value text;
  occurrence_id_value uuid;
  series_id_value uuid;
  rule_id_value uuid;
  rule_version_value integer;
  recurrence_data jsonb;
  recurrence_frequency text;
  recurrence_interval integer;
begin
  if record_row.record_type = 'appointment' then
    schedule_date := public.phase8_json_date(record_row.record_data, array['eventDate', 'date']);
    schedule_time := public.phase8_json_time(record_row.record_data, array['eventTime', 'time']);
    occurrence_kind_value := 'event';
  elsif record_row.record_type in ('task', 'bill', 'homeMatter') then
    schedule_date := public.phase8_json_date(record_row.record_data, array['dueDate', 'date']);
    occurrence_kind_value := 'action';
  elsif record_row.record_type = 'document' then
    schedule_date := public.phase8_json_date(record_row.record_data, array['expiryDate']);
    occurrence_kind_value := 'action';
  end if;

  occurrence_id_value := public.phase8_stable_uuid('phase8-occurrence|' || record_row.id::text || '|0');
  if record_row.deleted_at is not null or schedule_date is null then
    update public.occurrences
    set deleted_at = coalesce(record_row.deleted_at, statement_timestamp()),
        updated_by_membership_id = record_row.updated_by_membership_id
    where record_id = record_row.id and sequence = 0 and deleted_at is null;
    return;
  end if;

  timing_kind_value := case when occurrence_kind_value = 'event' and schedule_time is not null then 'local_datetime' else 'date' end;
  status_value := case
    when record_row.record_data->>'completed' = 'true' or record_row.record_data->>'status' = 'completed' then 'completed'
    when record_row.record_data->>'status' = 'cancelled' then 'cancelled'
    when occurrence_kind_value = 'event' then 'scheduled'
    else 'open'
  end;

  recurrence_data := record_row.record_data->'recurrence';
  recurrence_frequency := recurrence_data->>'unit';
  recurrence_interval := case when recurrence_data->>'interval' ~ '^\d+$' then (recurrence_data->>'interval')::integer end;
  if recurrence_frequency in ('week', 'month', 'year') and recurrence_interval > 0 then
    series_id_value := public.phase8_stable_uuid('phase8-series|' || record_row.id::text);
    insert into public.recurrence_series (id, care_space_id, record_id, created_by_membership_id)
    values (series_id_value, record_row.care_space_id, record_row.id, record_row.created_by_membership_id)
    on conflict (record_id) do nothing;

    select rule.id, rule.version into rule_id_value, rule_version_value
    from public.recurrence_rules rule
    where rule.series_id = series_id_value and rule.frequency = recurrence_frequency
      and rule.interval_value = recurrence_interval and rule.anchor_date = schedule_date and rule.state = 'active'
    order by rule.version desc limit 1;
    if rule_id_value is null then
      select coalesce(max(rule.version), 0) + 1 into rule_version_value
      from public.recurrence_rules rule where rule.series_id = series_id_value;
      rule_id_value := public.phase8_stable_uuid('phase8-rule|' || record_row.id::text || '|' || rule_version_value::text);
      insert into public.recurrence_rules (
        id, series_id, care_space_id, record_id, version, frequency, interval_value,
        anchor_date, effective_from, created_by_membership_id
      ) values (
        rule_id_value, series_id_value, record_row.care_space_id, record_row.id, rule_version_value,
        recurrence_frequency, recurrence_interval, schedule_date, schedule_date, record_row.updated_by_membership_id
      );
    end if;
  end if;

  insert into public.occurrences (
    id, care_space_id, record_id, occurrence_kind, status, timing_kind,
    due_on, starts_on, starts_time, timezone, recurrence_series_id, recurrence_rule_id,
    sequence, original_due_on, original_starts_on, original_starts_time, record_snapshot,
    completed_at, source, created_by_membership_id, updated_by_membership_id
  ) values (
    occurrence_id_value, record_row.care_space_id, record_row.id, occurrence_kind_value, status_value, timing_kind_value,
    case when timing_kind_value = 'date' then schedule_date end,
    case when timing_kind_value = 'local_datetime' then schedule_date end,
    case when timing_kind_value = 'local_datetime' then schedule_time end,
    case when timing_kind_value = 'local_datetime' then 'Europe/London' end,
    series_id_value, rule_id_value, 0,
    case when timing_kind_value = 'date' then schedule_date end,
    case when timing_kind_value = 'local_datetime' then schedule_date end,
    case when timing_kind_value = 'local_datetime' then schedule_time end,
    jsonb_build_object('title', record_row.record_data->>'title', 'record_type', record_row.record_type),
    case when status_value = 'completed'
      then public.phase8_json_timestamptz(record_row.record_data, 'completedAt', record_row.updated_at)
    end,
    record_row.source, record_row.created_by_membership_id, record_row.updated_by_membership_id
  )
  on conflict (record_id, sequence) do update
  set status = excluded.status,
      timing_kind = excluded.timing_kind,
      due_on = excluded.due_on,
      starts_on = excluded.starts_on,
      starts_time = excluded.starts_time,
      timezone = excluded.timezone,
      recurrence_series_id = excluded.recurrence_series_id,
      recurrence_rule_id = excluded.recurrence_rule_id,
      record_snapshot = excluded.record_snapshot,
      completed_at = excluded.completed_at,
      deleted_at = null,
      updated_by_membership_id = excluded.updated_by_membership_id
  where (public.occurrences.status, public.occurrences.timing_kind, public.occurrences.due_on,
    public.occurrences.starts_on, public.occurrences.starts_time, public.occurrences.timezone,
    public.occurrences.recurrence_series_id, public.occurrences.recurrence_rule_id,
    public.occurrences.record_snapshot, public.occurrences.completed_at, public.occurrences.deleted_at)
    is distinct from
    (excluded.status, excluded.timing_kind, excluded.due_on, excluded.starts_on,
    excluded.starts_time, excluded.timezone, excluded.recurrence_series_id,
    excluded.recurrence_rule_id, excluded.record_snapshot, excluded.completed_at, excluded.deleted_at);
end;
$$;

revoke all on function public.phase8_sync_record_occurrence(public.records) from public;

create function public.sync_record_occurrence_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.phase8_sync_record_occurrence(new);
  return new;
end;
$$;

revoke all on function public.sync_record_occurrence_trigger() from public;
create trigger records_sync_occurrence
after insert or update on public.records
for each row execute function public.sync_record_occurrence_trigger();

do $$
declare record_row public.records;
begin
  for record_row in select * from public.records loop
    perform public.phase8_sync_record_occurrence(record_row);
  end loop;
end;
$$;

alter table public.recurrence_series enable row level security;
alter table public.recurrence_series force row level security;
alter table public.recurrence_rules enable row level security;
alter table public.recurrence_rules force row level security;
alter table public.occurrences enable row level security;
alter table public.occurrences force row level security;
alter table public.occurrence_versions enable row level security;
alter table public.occurrence_versions force row level security;
alter table public.occurrence_mutation_receipts enable row level security;
alter table public.occurrence_mutation_receipts force row level security;
alter table public.care_space_contacts enable row level security;
alter table public.care_space_contacts force row level security;
alter table public.assignments enable row level security;
alter table public.assignments force row level security;

revoke all on table public.recurrence_series, public.recurrence_rules, public.occurrences,
  public.occurrence_versions, public.occurrence_mutation_receipts, public.care_space_contacts,
  public.assignments from anon, authenticated;
grant select on table public.recurrence_series, public.recurrence_rules, public.occurrences,
  public.occurrence_versions, public.care_space_contacts, public.assignments to authenticated;

create policy "active organisers can read recurrence series" on public.recurrence_series
for select to authenticated using (public.can_access_care_space_records(care_space_id, 'general', 'read'));
create policy "active organisers can read recurrence rules" on public.recurrence_rules
for select to authenticated using (public.can_access_care_space_records(care_space_id, 'general', 'read'));
create policy "active organisers can read occurrences" on public.occurrences
for select to authenticated using (public.can_access_care_space_records(care_space_id, 'general', 'read'));
create policy "active organisers can read occurrence history" on public.occurrence_versions
for select to authenticated using (exists (
  select 1 from public.occurrences occurrence
  where occurrence.id = occurrence_id and public.can_access_care_space_records(occurrence.care_space_id, 'general', 'read')
));
create policy "active organisers can read contacts" on public.care_space_contacts
for select to authenticated using (public.can_access_care_space_records(care_space_id, 'general', 'read'));
create policy "active organisers can read assignments" on public.assignments
for select to authenticated using (public.can_access_care_space_records(care_space_id, 'general', 'read'));

create function public.apply_occurrence_mutation(
  operation_id uuid,
  target_occurrence_id uuid,
  target_care_space_id uuid,
  mutation_kind text,
  base_version integer,
  mutation_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  current_occurrence public.occurrences%rowtype;
  existing_receipt public.occurrence_mutation_receipts%rowtype;
  recurrence_rule public.recurrence_rules%rowtype;
  next_date date;
  next_occurrence_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null or not public.can_access_care_space_records(target_care_space_id, 'general', 'write') then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;
  if mutation_kind not in ('complete', 'cancel', 'reopen', 'set_timing') then
    raise exception 'Unsupported occurrence mutation' using errcode = '22023';
  end if;
  select * into existing_receipt from public.occurrence_mutation_receipts receipt
  where receipt.operation_id = apply_occurrence_mutation.operation_id;
  if found then
    if existing_receipt.care_space_id <> target_care_space_id
      or existing_receipt.occurrence_id <> target_occurrence_id
      or existing_receipt.actor_membership_id <> caller_membership_id
      or existing_receipt.mutation_kind <> mutation_kind then
      raise exception 'Operation identity cannot be reused' using errcode = '22023';
    end if;
    return jsonb_build_object('status', 'duplicate', 'version', existing_receipt.result_version,
      'change_sequence', existing_receipt.result_change_sequence);
  end if;
  select * into current_occurrence from public.occurrences
  where id = target_occurrence_id and care_space_id = target_care_space_id for update;
  if not found then return jsonb_build_object('status', 'conflict', 'reason', 'occurrence_missing'); end if;
  if current_occurrence.version <> base_version then
    return jsonb_build_object('status', 'conflict', 'reason', 'stale_version', 'version', current_occurrence.version);
  end if;
  if mutation_kind = 'complete' then
    if current_occurrence.status not in ('open', 'scheduled', 'awaiting_confirmation') then
      return jsonb_build_object('status', 'conflict', 'reason', 'invalid_transition');
    end if;
    update public.occurrences set status = 'completed', completed_at = statement_timestamp(),
      updated_by_membership_id = caller_membership_id where id = target_occurrence_id returning * into current_occurrence;
  elsif mutation_kind = 'cancel' then
    if current_occurrence.status in ('completed', 'cancelled', 'missed') then
      return jsonb_build_object('status', 'conflict', 'reason', 'invalid_transition');
    end if;
    update public.occurrences set status = 'cancelled', completed_at = null,
      updated_by_membership_id = caller_membership_id where id = target_occurrence_id returning * into current_occurrence;
  elsif mutation_kind = 'reopen' then
    if current_occurrence.status not in ('completed', 'cancelled', 'missed') then
      return jsonb_build_object('status', 'conflict', 'reason', 'invalid_transition');
    end if;
    update public.occurrences set status = case when occurrence_kind = 'event' then 'scheduled' else 'open' end,
      completed_at = null, updated_by_membership_id = caller_membership_id
      where id = target_occurrence_id returning * into current_occurrence;
  else
    if current_occurrence.status in ('completed', 'cancelled', 'missed') then
      return jsonb_build_object('status', 'conflict', 'reason', 'historical_occurrence');
    end if;
    if mutation_payload->>'timing_kind' = 'date' and public.phase8_json_date(mutation_payload, array['due_on']) is not null then
      update public.occurrences set timing_kind = 'date', due_on = public.phase8_json_date(mutation_payload, array['due_on']),
        starts_on = null, starts_time = null, timezone = null, instant_at = null,
        updated_by_membership_id = caller_membership_id where id = target_occurrence_id returning * into current_occurrence;
    elsif mutation_payload->>'timing_kind' = 'local_datetime'
      and public.phase8_json_date(mutation_payload, array['starts_on']) is not null
      and public.phase8_json_time(mutation_payload, array['starts_time']) is not null
      and char_length(coalesce(mutation_payload->>'timezone', '')) > 0 then
      update public.occurrences set timing_kind = 'local_datetime', due_on = null,
        starts_on = public.phase8_json_date(mutation_payload, array['starts_on']),
        starts_time = public.phase8_json_time(mutation_payload, array['starts_time']),
        timezone = mutation_payload->>'timezone', instant_at = null,
        updated_by_membership_id = caller_membership_id where id = target_occurrence_id returning * into current_occurrence;
    else
      raise exception 'Invalid occurrence timing payload' using errcode = '22023';
    end if;
  end if;

  if mutation_kind = 'complete' and current_occurrence.recurrence_rule_id is not null then
    select * into recurrence_rule from public.recurrence_rules
    where id = current_occurrence.recurrence_rule_id and care_space_id = target_care_space_id;
    if found and recurrence_rule.state = 'active' then
      next_date := public.phase8_recurrence_date(
        recurrence_rule.anchor_date, recurrence_rule.frequency,
        recurrence_rule.interval_value, current_occurrence.sequence + 1
      );
      next_occurrence_id := public.phase8_stable_uuid(
        'phase8-occurrence|' || current_occurrence.record_id::text || '|' || (current_occurrence.sequence + 1)::text
      );
      insert into public.occurrences (
        id, care_space_id, record_id, occurrence_kind, status, timing_kind,
        due_on, starts_on, starts_time, timezone, recurrence_series_id, recurrence_rule_id,
        sequence, original_due_on, original_starts_on, original_starts_time, record_snapshot,
        source, created_by_membership_id, updated_by_membership_id
      ) values (
        next_occurrence_id, current_occurrence.care_space_id, current_occurrence.record_id,
        current_occurrence.occurrence_kind,
        case when current_occurrence.occurrence_kind = 'event' then 'scheduled' else 'open' end,
        current_occurrence.timing_kind,
        case when current_occurrence.timing_kind = 'date' then next_date end,
        case when current_occurrence.timing_kind = 'local_datetime' then next_date end,
        current_occurrence.starts_time, current_occurrence.timezone,
        current_occurrence.recurrence_series_id, current_occurrence.recurrence_rule_id,
        current_occurrence.sequence + 1,
        case when current_occurrence.timing_kind = 'date' then next_date end,
        case when current_occurrence.timing_kind = 'local_datetime' then next_date end,
        current_occurrence.original_starts_time, current_occurrence.record_snapshot,
        current_occurrence.source, caller_membership_id, caller_membership_id
      ) on conflict (record_id, sequence) do nothing;
    end if;
  end if;

  insert into public.occurrence_mutation_receipts (
    operation_id, care_space_id, occurrence_id, actor_membership_id, mutation_kind,
    result_version, result_change_sequence
  ) values (
    operation_id, target_care_space_id, target_occurrence_id, caller_membership_id, mutation_kind,
    current_occurrence.version, current_occurrence.change_sequence
  );
  return jsonb_build_object('status', 'applied', 'version', current_occurrence.version,
    'change_sequence', current_occurrence.change_sequence);
end;
$$;

revoke all on function public.apply_occurrence_mutation(uuid, uuid, uuid, text, integer, jsonb) from public;
revoke all on function public.apply_occurrence_mutation(uuid, uuid, uuid, text, integer, jsonb) from anon;
grant execute on function public.apply_occurrence_mutation(uuid, uuid, uuid, text, integer, jsonb) to authenticated;

create function public.create_assignment(
  operation_id uuid,
  assignment_id uuid,
  target_care_space_id uuid,
  target_type text,
  target_id uuid,
  assignee_type text,
  assignee_id uuid
)
returns public.assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  snapshot_name text;
  result_assignment public.assignments%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null or not public.can_access_care_space_records(target_care_space_id, 'general', 'write') then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;
  if target_type = 'record' then
    perform 1 from public.records where id = target_id and care_space_id = target_care_space_id;
  elsif target_type = 'occurrence' then
    perform 1 from public.occurrences where id = target_id and care_space_id = target_care_space_id;
  else
    raise exception 'Invalid assignment target' using errcode = '22023';
  end if;
  if not found then raise exception 'Assignment target is outside care space' using errcode = '42501'; end if;

  if assignee_type = 'membership' then
    select profile.display_name into snapshot_name
    from public.care_space_memberships membership
    join public.profiles profile on profile.id = membership.user_id
    where membership.id = assignee_id and membership.care_space_id = target_care_space_id
      and membership.membership_status = 'active';
  elsif assignee_type = 'external_contact' then
    select contact.display_name into snapshot_name from public.care_space_contacts contact
    where contact.id = assignee_id and contact.care_space_id = target_care_space_id;
  else
    raise exception 'Invalid assignee type' using errcode = '22023';
  end if;
  if snapshot_name is null then raise exception 'Assignee is not active in care space' using errcode = '42501'; end if;

  select * into result_assignment from public.assignments where assignments.operation_id = create_assignment.operation_id;
  if found then
    if result_assignment.id <> assignment_id
      or result_assignment.care_space_id <> target_care_space_id
      or coalesce(result_assignment.record_id, result_assignment.occurrence_id) <> target_id
      or coalesce(result_assignment.membership_id, result_assignment.external_contact_id) <> assignee_id then
      raise exception 'Assignment operation identity cannot be reused' using errcode = '22023';
    end if;
    return result_assignment;
  end if;

  insert into public.assignments (
    id, operation_id, care_space_id, record_id, occurrence_id, assignee_type, membership_id,
    external_contact_id, display_name_snapshot, assigned_by_membership_id
  ) values (
    assignment_id, operation_id, target_care_space_id,
    case when target_type = 'record' then target_id end,
    case when target_type = 'occurrence' then target_id end,
    assignee_type,
    case when assignee_type = 'membership' then assignee_id end,
    case when assignee_type = 'external_contact' then assignee_id end,
    snapshot_name, caller_membership_id
  )
  on conflict (id) do nothing
  returning * into result_assignment;
  if result_assignment.id is null then
    select * into result_assignment from public.assignments where id = assignment_id;
    if result_assignment.care_space_id <> target_care_space_id
      or coalesce(result_assignment.record_id, result_assignment.occurrence_id) <> target_id
      or coalesce(result_assignment.membership_id, result_assignment.external_contact_id) <> assignee_id then
      raise exception 'Assignment identity cannot be reused' using errcode = '22023';
    end if;
  end if;
  return result_assignment;
end;
$$;

revoke all on function public.create_assignment(uuid, uuid, uuid, text, uuid, text, uuid) from public;
revoke all on function public.create_assignment(uuid, uuid, uuid, text, uuid, text, uuid) from anon;
grant execute on function public.create_assignment(uuid, uuid, uuid, text, uuid, text, uuid) to authenticated;

comment on table public.occurrences is 'Phase 8 canonical dated instances of durable records.';
comment on column public.occurrences.record_snapshot is 'Minimal expectation snapshot retained independently from current parent record values.';
comment on table public.recurrence_rules is 'Immutable recurrence rule versions; later edits create another version.';
comment on table public.assignments is 'Stable assignment identity only. Rows never grant record visibility.';
comment on table public.care_space_contacts is 'Named external contacts with no Lilica account access by virtue of this row.';
