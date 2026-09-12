import { LilicaRecord, LilicaRecordType, RecordRecurrence } from './types';

// Phase 15: mirrors the server's record_domain_for_type() exactly (see
// supabase/migrations/20260910150000_phase7_records.sql). Client-side use is
// advisory only -- it lets the assignment selector avoid offering a member
// who plainly cannot see this record's domain, but apply_record_mutation()'s
// own server-side check is what actually enforces it.
export function recordDomainForType(type: LilicaRecordType): 'general' | 'health' | 'financial' | 'home' | 'documents' {
  switch (type) {
    case 'careNote':
      return 'health';
    case 'bill':
      return 'financial';
    case 'homeMatter':
      return 'home';
    case 'document':
      return 'documents';
    default:
      return 'general';
  }
}

export type DerivedRecordState = {
  dueToday: boolean;
  overdue: boolean;
  upcoming: boolean;
  completed: boolean;
  unresolved: boolean;
  recentlyUpdated: boolean;
  nextDueDate?: string;
};

export function upsertRecord(records: LilicaRecord[], record: LilicaRecord) {
  return records.some((item) => item.id === record.id)
    ? records.map((item) => item.id === record.id ? record : item)
    : [...records, record];
}

export function removeRecordById(records: LilicaRecord[], recordId: string) {
  return records.filter((record) => record.id !== recordId);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function addRecurrence(date: Date, recurrence: RecordRecurrence) {
  const next = new Date(date);
  if (recurrence.unit === 'week') next.setDate(next.getDate() + (7 * recurrence.interval));
  if (recurrence.unit === 'month') next.setMonth(next.getMonth() + recurrence.interval);
  if (recurrence.unit === 'year') next.setFullYear(next.getFullYear() + recurrence.interval);
  return next;
}

export function toIsoDate(value: string) {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const ukMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  const parts = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : ukMatch
      ? { year: Number(ukMatch[3]), month: Number(ukMatch[2]), day: Number(ukMatch[1]) }
      : undefined;

  if (!parts) return undefined;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  if (
    date.getFullYear() !== parts.year
    || date.getMonth() !== parts.month - 1
    || date.getDate() !== parts.day
  ) return undefined;

  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function formatDateForInput(value?: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function formatDateForDisplay(value?: string) {
  if (!value) return undefined;
  const parsed = parseDate(value);
  return parsed?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) ?? value;
}

// Phase 10: the date a record projects onto in Calendar. Mirrors the exact
// same field priority as domain/recordOccurrence.ts's canonicalOccurrenceForRecord
// (appointment -> eventDate; task/bill/homeMatter -> dueDate; document ->
// expiryDate; everything else has no calendar meaning) but operates on the
// local record directly with no dependency on a synced cloud record ID, so
// it works fully offline from whatever is already cached -- exactly like
// deriveRecordState() below. Returning undefined means "not calendar-eligible",
// never a fabricated date.
export function calendarDateForRecord(record: LilicaRecord): string | undefined {
  if (record.type === 'appointment') return record.eventDate ?? record.date;
  if (record.type === 'task' || record.type === 'bill' || record.type === 'homeMatter') return record.dueDate ?? record.date;
  if (record.type === 'document') return record.expiryDate;
  return undefined;
}

// Phase 17: a human-readable one-line summary for the "Related to" picker
// and for RecordDetail's own related-record rows -- title plus whatever
// date the record already presents elsewhere (calendarDateForRecord's
// exact same field priority, plus a due-date fallback for task/bill/
// homeMatter so a task with no calendar-eligible date still gets a
// useful subtitle). Built only from existing canonical fields -- no new
// field, no fabricated text, never a UUID/type/domain name.
export function linkPickerSummary(record: LilicaRecord): { id: string; title: string; subtitle?: string } {
  const date = calendarDateForRecord(record) ?? record.dueDate ?? record.date;
  const time = record.eventTime ?? record.time;
  const dateLabel = formatDateForDisplay(date);
  const subtitle = dateLabel
    ? (time ? `${dateLabel} · ${time}` : dateLabel)
    : undefined;
  return { id: record.id, title: record.title, subtitle };
}

// Phase 17: which record types are appropriate "Related to" targets for a
// document -- audited against the current canonical categories rather
// than assumed from memory. A document may relate to the everyday things
// it's evidence for; it is never offered as its own target, and contacts/
// care notes/updates/other documents are excluded as not meaningfully
// "the thing a document is related to" for this first pass.
const LINKABLE_TYPES: LilicaRecordType[] = ['appointment', 'task', 'bill', 'homeMatter'];

export function isLinkableRecordType(type: LilicaRecordType): boolean {
  return LINKABLE_TYPES.includes(type);
}

// Phase 12: which records are genuinely actionable "To Do" work, per
// docs/CORE_SYSTEM_CONTRACT.md section 9.3 -- explicit tasks, actionable
// bill/renewal occurrences, and actionable home/car matters. Appointments,
// documents, contacts, care information and updates are informational or
// merely dated, not actionable, and never enter this projection even
// though some of them have dates and already appear in Calendar.
const ACTIONABLE_TYPES: LilicaRecordType[] = ['task', 'bill', 'homeMatter'];

export function isActionableRecord(record: LilicaRecord): boolean {
  return ACTIONABLE_TYPES.includes(record.type) && record.status !== 'cancelled';
}

export function deriveRecordState(record: LilicaRecord, now = new Date()): DerivedRecordState {
  const today = startOfDay(now);
  const relevantDate = parseDate(record.dueDate ?? record.eventDate);
  const completed = record.completed === true || record.status === 'completed';
  const difference = relevantDate
    ? Math.round((startOfDay(relevantDate).getTime() - today.getTime()) / 86_400_000)
    : undefined;
  const updatedAt = new Date(record.updatedAt ?? record.createdAt);
  const recentlyUpdated = !Number.isNaN(updatedAt.getTime())
    && now.getTime() - updatedAt.getTime() <= 7 * 86_400_000;
  const nextDue = completed && record.recurrence && relevantDate
    ? addRecurrence(relevantDate, record.recurrence)
    : undefined;

  return {
    dueToday: !completed && difference === 0,
    overdue: !completed && difference !== undefined && difference < 0,
    upcoming: !completed && difference !== undefined && difference > 0,
    completed,
    unresolved: !completed && record.status === 'unresolved',
    recentlyUpdated,
    nextDueDate: nextDue
      ? `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, '0')}-${String(nextDue.getDate()).padStart(2, '0')}`
      : undefined,
  };
}
