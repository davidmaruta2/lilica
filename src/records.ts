import { LilicaRecord, RecordRecurrence } from './types';

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
