-- Fix: assignments' own read policy was gated on blanket 'general'
-- domain access, not the actual domain of the record/occurrence the
-- assignment concerns -- found and flagged, not yet fixed, during the
-- Care Circle permission-domain audit
-- (docs/REVISION_LOG.md, "15 September 2026 - Care Circle permission-
-- domain explanations"). A member with only 'general' read access (the
-- default for any active member) could see that an assignment existed
-- for a financial/health/home-domain record and who it was assigned to
-- (display_name_snapshot), even without that record's own domain grant --
-- a narrow metadata-only exposure (never the record's own title/content,
-- which stayed correctly gated), but a genuine inconsistency against
-- every other per-row policy in this schema (record_attachments,
-- care_space_activity, records/occurrences themselves), which all
-- correctly resolve to the SPECIFIC record's own domain rather than a
-- blanket one.
--
-- An assignment targets EXACTLY one of record_id or occurrence_id
-- (assignments_target_exactly_one, unchanged) -- resolve whichever is set
-- to its owning record's own record_domain (an occurrence's own
-- record_id already links back to records, exactly like
-- record_attachments' own policy already does via its record_id).
drop policy "active organisers can read assignments" on public.assignments;

create policy "active members can read domain-authorised assignments" on public.assignments
for select to authenticated using (
  public.can_access_care_space_records(
    care_space_id,
    coalesce(
      (select r.record_domain from public.records r where r.id = assignments.record_id),
      (select r.record_domain from public.occurrences o
        join public.records r on r.id = o.record_id
        where o.id = assignments.occurrence_id)
    ),
    'read'
  )
);

comment on policy "active members can read domain-authorised assignments" on public.assignments is
  'Resolves the SPECIFIC record domain an assignment concerns (via record_id directly, or via occurrence_id -> occurrences.record_id) -- never a blanket domain, matching every other per-row read policy in this schema.';

-- ---------------------------------------------------------------------
-- Future-maintenance hardening: record_domain_for_type() -- found during
-- the same Care Circle permission-domain audit. The `records_type` CHECK
-- constraint already makes an unmapped record_type impossible to insert
-- today (structural defence #1) -- but this function's own previous
-- `else -> 'general'` branch meant that if a FUTURE developer ever added
-- a new value to that CHECK constraint without also adding a matching
-- case here, the new type would silently inherit the LEAST-sensitive
-- domain rather than failing loudly. Every one of the eight currently
-- real record types now has its own explicit branch; anything else
-- raises, rather than silently defaulting -- structural defence #2,
-- independent of the CHECK constraint rather than relying on it alone.
create or replace function public.record_domain_for_type(value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  case value
    when 'careNote' then return 'health';
    when 'bill' then return 'financial';
    when 'homeMatter' then return 'home';
    when 'document' then return 'documents';
    when 'appointment', 'task', 'contact', 'update' then return 'general';
    else
      raise exception 'record_domain_for_type: unmapped record type "%" -- every record type must have an explicit permission domain', value
        using errcode = '22023';
  end case;
end;
$$;
