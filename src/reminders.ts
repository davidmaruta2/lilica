import { LilicaRecord, LilicaRecordType } from './types';

// Phase 14: pure reminder-domain logic, deliberately separate from the
// notification-delivery layer (src/notifications.ts) and from record
// truth. See docs/PHASE_14_ARCHITECTURE.md's "Three-state separation":
// (1) record/occurrence state, (2) in-app attention state (deriveRecordState
// in records.ts), (3) notification delivery state (scheduled local
// notifications only, never written back here). Nothing in this file
// mutates a record; it only computes candidate reminder occasions from a
// record's existing fields, mirroring the same precedent as
// calendarDateForRecord()/isActionableRecord() in records.ts.

export type ReminderOffsetKey = 'appt-1day' | 'appt-2hour' | 'dateOnly-3day' | 'dateOnly-dueDay';

export const ALL_REMINDER_OFFSET_KEYS: ReminderOffsetKey[] = [
  'appt-1day',
  'appt-2hour',
  'dateOnly-3day',
  'dateOnly-dueDay',
];

export type ReminderOccasion = {
  key: ReminderOffsetKey;
  fireAt: Date;
};

export type QuietHours = {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

// Only genuinely time/action-relevant records qualify -- never informational
// ones. Matches Phase 12's isActionableRecord() plus appointment, since an
// appointment (unlike a completed/cancelled item) can meaningfully remind.
const REMINDER_ELIGIBLE_TYPES: LilicaRecordType[] = ['appointment', 'task', 'bill', 'homeMatter'];

export function isReminderEligible(record: LilicaRecord): boolean {
  if (!REMINDER_ELIGIBLE_TYPES.includes(record.type)) return false;
  if (record.status === 'cancelled') return false;
  if (record.completed) return false;
  return true;
}

// Local wall-clock construction (device-local time), the same "no guessed
// UTC conversion" precedent already established for appointments in
// domain/recordOccurrence.ts and records.ts -- correct across BST/GMT
// transitions because the JS Date local constructor resolves DST using the
// runtime's own timezone rules, not manual offset arithmetic.
function parseLocalDateTime(date?: string, time?: string): Date | undefined {
  if (!date) return undefined;
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  if (time) {
    const [hour, minute] = time.split(':').map(Number);
    if (!Number.isNaN(hour) && !Number.isNaN(minute)) return new Date(year, month - 1, day, hour, minute);
  }
  return new Date(year, month - 1, day);
}

// Phase 14 default reminder policy (brief section 9): conservative,
// type-specific offsets. A candidate occasion whose fire time has already
// passed relative to `now` is simply omitted -- never manufactured
// retroactively (e.g. an appointment created 30 minutes before it starts
// never produces a missed "1 day before" notification).
export function reminderOccasionsForRecord(record: LilicaRecord, now: Date = new Date()): ReminderOccasion[] {
  if (!isReminderEligible(record) || !record.remindersEnabled) return [];

  const occasions: ReminderOccasion[] = [];

  if (record.type === 'appointment') {
    const start = parseLocalDateTime(record.eventDate ?? record.date, record.eventTime ?? record.time);
    if (!start) return [];
    occasions.push({ key: 'appt-1day', fireAt: new Date(start.getTime() - 24 * 60 * 60 * 1000) });
    occasions.push({ key: 'appt-2hour', fireAt: new Date(start.getTime() - 2 * 60 * 60 * 1000) });
  } else {
    const due = parseLocalDateTime(record.dueDate ?? record.date);
    if (!due) return [];
    occasions.push({ key: 'dateOnly-3day', fireAt: new Date(due.getTime() - 3 * 24 * 60 * 60 * 1000) });
    // Date-only records carry no time of their own; 09:00 is a reasonable,
    // documented default for the "on the due date" occasion.
    occasions.push({ key: 'dateOnly-dueDay', fireAt: new Date(due.getFullYear(), due.getMonth(), due.getDate(), 9, 0) });
  }

  return occasions.filter((occasion) => occasion.fireAt.getTime() > now.getTime());
}

// Deterministic policy: a fire time inside quiet hours moves forward to the
// moment quiet hours end (never earlier, never dropped). Supports an
// overnight window (e.g. 22:00-07:00) that crosses midnight.
export function applyQuietHours(fireAt: Date, quietHours?: QuietHours): Date {
  if (!quietHours) return fireAt;
  const { startHour, startMinute, endHour, endMinute } = quietHours;
  const startsBeforeEnds = startHour < endHour || (startHour === endHour && startMinute < endMinute);
  const minutesOfDay = fireAt.getHours() * 60 + fireAt.getMinutes();
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const inQuietHours = startsBeforeEnds
    ? minutesOfDay >= startMinutes && minutesOfDay < endMinutes
    : minutesOfDay >= startMinutes || minutesOfDay < endMinutes;
  if (!inQuietHours) return fireAt;

  const resolved = new Date(fireAt);
  resolved.setHours(endHour, endMinute, 0, 0);
  // Overnight window (start > end) and the fire time fell in the late-night
  // portion before midnight -- quiet hours end the following morning.
  if (!startsBeforeEnds && minutesOfDay >= startMinutes) resolved.setDate(resolved.getDate() + 1);
  return resolved;
}

// Idempotent identity: the same (record, offset, schedule version) always
// produces the same identifier, so rescheduling the same still-valid
// occasion overwrites rather than duplicates (expo-notifications replaces
// an existing scheduled notification sharing an identifier). A changed
// schedule version (date/time edit) produces a new identifier, so the old
// one is explicitly cancelled by the caller rather than silently orphaned.
export function reminderNotificationId(recordId: string, offsetKey: ReminderOffsetKey, scheduleVersion: number): string {
  return `reminder:${recordId}:${offsetKey}:v${scheduleVersion}`;
}

// A snoozed reminder is a genuinely new delivery (brief section 22): its own
// identifier, namespaced separately so it can never collide with or replace
// the original occasion's identifier.
export function snoozeNotificationId(recordId: string, offsetKey: ReminderOffsetKey, scheduleVersion: number, snoozeToken: number): string {
  return `reminder-snooze:${recordId}:${offsetKey}:v${scheduleVersion}:${snoozeToken}`;
}

const TYPE_NOUN: Partial<Record<LilicaRecordType, string>> = {
  appointment: 'appointment',
  bill: 'bill',
  homeMatter: 'home or car matter',
  task: 'to do',
};

// Conservative, lock-screen-safe content (brief section 33): title/type and
// person context only, never notes or other potentially sensitive detail.
export function reminderTitle(record: LilicaRecord, personName?: string): string {
  const noun = TYPE_NOUN[record.type] ?? 'reminder';
  const possessive = personName ? `${personName}'s` : 'Your';
  return `${possessive} ${noun}`;
}

export function reminderBody(record: LilicaRecord, offsetKey: ReminderOffsetKey): string {
  if (offsetKey === 'appt-1day') return `${record.title} is tomorrow`;
  if (offsetKey === 'appt-2hour') return `${record.title} is today`;
  if (offsetKey === 'dateOnly-dueDay') return `${record.title} is due today`;
  return `${record.title} is coming up`;
}
