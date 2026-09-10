import {
  applyQuietHours,
  isReminderEligible,
  reminderNotificationId,
  reminderOccasionsForRecord,
  reminderTitle,
  reminderBody,
  snoozeNotificationId,
} from '../src/reminders';
import { LilicaRecord } from '../src/types';

// Phase 14 domain logic: pure functions, no native dependency. This is
// where the brief's core invariants live -- reminder state is computed
// from record fields, never the other way round.

describe('Phase 14: eligibility (informational records never generate reminders)', () => {
  it('appointment, task, bill and homeMatter are eligible', () => {
    const base = { id: '1', title: 'x', createdAt: '2026-09-01T00:00:00.000Z' };
    expect(isReminderEligible({ ...base, type: 'appointment' })).toBe(true);
    expect(isReminderEligible({ ...base, type: 'task' })).toBe(true);
    expect(isReminderEligible({ ...base, type: 'bill' })).toBe(true);
    expect(isReminderEligible({ ...base, type: 'homeMatter' })).toBe(true);
  });

  it('document, contact, careNote and update are never eligible', () => {
    const base = { id: '1', title: 'x', createdAt: '2026-09-01T00:00:00.000Z' };
    expect(isReminderEligible({ ...base, type: 'document' })).toBe(false);
    expect(isReminderEligible({ ...base, type: 'contact' })).toBe(false);
    expect(isReminderEligible({ ...base, type: 'careNote' })).toBe(false);
    expect(isReminderEligible({ ...base, type: 'update' })).toBe(false);
  });

  it('a cancelled or completed record is never eligible, even if the type otherwise qualifies', () => {
    const base = { id: '1', title: 'x', type: 'task' as const, createdAt: '2026-09-01T00:00:00.000Z' };
    expect(isReminderEligible({ ...base, status: 'cancelled' })).toBe(false);
    expect(isReminderEligible({ ...base, completed: true })).toBe(false);
  });
});

describe('Phase 14: default reminder policy (fixed scenarios)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-01T00:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('scenario A: appointment with a time offers 1-day and 2-hour occasions', () => {
    const dentist: LilicaRecord = {
      id: 'appt-1', type: 'appointment', title: 'Dentist', status: 'scheduled',
      eventDate: '2026-09-21', eventTime: '10:00', remindersEnabled: true,
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const occasions = reminderOccasionsForRecord(dentist);
    const keys = occasions.map((o) => o.key).sort();
    expect(keys).toEqual(['appt-1day', 'appt-2hour']);
    // Local wall-clock fields (never UTC/ISO string comparison, which would
    // depend on the test machine's own timezone rather than the same local
    // construction the implementation itself uses).
    const oneDay = occasions.find((o) => o.key === 'appt-1day')!;
    expect(oneDay.fireAt.getDate()).toBe(20);
    expect(oneDay.fireAt.getHours()).toBe(10);
    const twoHour = occasions.find((o) => o.key === 'appt-2hour')!;
    expect(twoHour.fireAt.getDate()).toBe(21);
    expect(twoHour.fireAt.getHours()).toBe(8);
  });

  it('scenario B: date-only bill offers 3-days-before and on-due-day occasions', () => {
    const insurance: LilicaRecord = {
      id: 'bill-1', type: 'bill', title: 'Home insurance renewal', status: 'unresolved',
      dueDate: '2026-09-30', remindersEnabled: true, createdAt: '2026-09-01T00:00:00.000Z',
    };
    const occasions = reminderOccasionsForRecord(insurance);
    const keys = occasions.map((o) => o.key).sort();
    expect(keys).toEqual(['dateOnly-3day', 'dateOnly-dueDay']);
    const threeDay = occasions.find((o) => o.key === 'dateOnly-3day')!;
    expect(threeDay.fireAt.getDate()).toBe(27);
    const dueDay = occasions.find((o) => o.key === 'dateOnly-dueDay')!;
    expect(dueDay.fireAt.getDate()).toBe(30);
    expect(dueDay.fireAt.getHours()).toBe(9);
  });

  it('a record with reminders not enabled produces no occasions', () => {
    const bill: LilicaRecord = { id: 'b1', type: 'bill', title: 'x', status: 'unresolved', dueDate: '2026-09-30', createdAt: '2026-09-01T00:00:00.000Z' };
    expect(reminderOccasionsForRecord(bill)).toEqual([]);
  });

  it('too-late lead time is omitted rather than manufactured retroactively', () => {
    // "now" is fixed at 2026-09-01T00:00; an appointment 30 minutes from
    // now can't produce a 1-day-before occasion in the past.
    jest.setSystemTime(new Date('2026-09-21T09:35:00.000Z'));
    const lastMinute: LilicaRecord = {
      id: 'appt-2', type: 'appointment', title: 'Urgent visit', status: 'scheduled',
      eventDate: '2026-09-21', eventTime: '10:05', remindersEnabled: true,
      createdAt: '2026-09-21T09:00:00.000Z',
    };
    const occasions = reminderOccasionsForRecord(lastMinute);
    expect(occasions.map((o) => o.key)).not.toContain('appt-1day');
  });

  it('an undated task produces no occasions (nothing to schedule against)', () => {
    const task: LilicaRecord = { id: 't1', type: 'task', title: 'Someday', status: 'unresolved', remindersEnabled: true, createdAt: '2026-09-01T00:00:00.000Z' };
    expect(reminderOccasionsForRecord(task)).toEqual([]);
  });
});

describe('Phase 14: appointment semantics respected (no overdue-task reinterpretation)', () => {
  it('a past appointment is still eligible in principle, but produces no occasion for a time that has already passed', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-22T00:00:00.000Z'));
    const pastAppt: LilicaRecord = {
      id: 'appt-3', type: 'appointment', title: 'Yesterday', status: 'scheduled',
      eventDate: '2026-09-21', eventTime: '10:00', remindersEnabled: true,
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    expect(reminderOccasionsForRecord(pastAppt)).toEqual([]);
    jest.useRealTimers();
  });
});

describe('Phase 14: quiet hours', () => {
  it('a fire time inside an overnight quiet-hours window moves to the end of quiet hours', () => {
    const fireAt = new Date(2026, 8, 20, 22, 30); // 22:30, inside 21:00-08:00
    const resolved = applyQuietHours(fireAt, { startHour: 21, startMinute: 0, endHour: 8, endMinute: 0 });
    expect(resolved.getHours()).toBe(8);
    expect(resolved.getMinutes()).toBe(0);
    expect(resolved.getDate()).toBe(21); // next morning
  });

  it('a fire time in the early-morning portion of an overnight window moves to end-of-window the same day', () => {
    const fireAt = new Date(2026, 8, 20, 5, 0); // 05:00, inside 21:00-08:00 (overnight)
    const resolved = applyQuietHours(fireAt, { startHour: 21, startMinute: 0, endHour: 8, endMinute: 0 });
    expect(resolved.getDate()).toBe(20);
    expect(resolved.getHours()).toBe(8);
  });

  it('a fire time outside quiet hours is left unchanged', () => {
    const fireAt = new Date(2026, 8, 20, 14, 0);
    const resolved = applyQuietHours(fireAt, { startHour: 21, startMinute: 0, endHour: 8, endMinute: 0 });
    expect(resolved.getTime()).toBe(fireAt.getTime());
  });

  it('quiet hours never change due dates or occurrence status -- only the fire time', () => {
    const fireAt = new Date(2026, 8, 20, 22, 30);
    const resolved = applyQuietHours(fireAt, { startHour: 21, startMinute: 0, endHour: 8, endMinute: 0 });
    // Only asserting the function's return value is a new Date instance,
    // never a mutation of the input.
    expect(fireAt.getHours()).toBe(22);
    expect(resolved).not.toBe(fireAt);
  });

  it('without quiet hours configured, the fire time passes through unchanged', () => {
    const fireAt = new Date(2026, 8, 20, 23, 0);
    expect(applyQuietHours(fireAt, undefined).getTime()).toBe(fireAt.getTime());
  });
});

describe('Phase 14: timezone / DST / calendar edge cases', () => {
  it('a due date on a month end resolves correctly for the 3-day-before occasion', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const record: LilicaRecord = { id: 'b1', type: 'bill', title: 'x', status: 'unresolved', dueDate: '2026-03-01', remindersEnabled: true, createdAt: '2026-01-01T00:00:00.000Z' };
    const occasions = reminderOccasionsForRecord(record);
    const threeDay = occasions.find((o) => o.key === 'dateOnly-3day')!;
    expect(threeDay.fireAt.getMonth()).toBe(1); // February
    expect(threeDay.fireAt.getDate()).toBe(26);
    jest.useRealTimers();
  });

  it('a leap-day due date is handled without throwing', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2028-02-01T00:00:00.000Z'));
    const record: LilicaRecord = { id: 'b2', type: 'bill', title: 'x', status: 'unresolved', dueDate: '2028-02-29', remindersEnabled: true, createdAt: '2028-02-01T00:00:00.000Z' };
    expect(() => reminderOccasionsForRecord(record)).not.toThrow();
    jest.useRealTimers();
  });

  it('an appointment across the BST->GMT transition (late October) still produces both occasions', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
    const record: LilicaRecord = {
      id: 'appt-4', type: 'appointment', title: 'Late October visit', status: 'scheduled',
      eventDate: '2026-10-26', eventTime: '10:00', remindersEnabled: true, createdAt: '2026-10-01T00:00:00.000Z',
    };
    const occasions = reminderOccasionsForRecord(record);
    expect(occasions.map((o) => o.key).sort()).toEqual(['appt-1day', 'appt-2hour']);
    jest.useRealTimers();
  });
});

describe('Phase 14: idempotent identity', () => {
  it('the same record/offset/version always produces the same identifier', () => {
    expect(reminderNotificationId('rec-1', 'appt-1day', 3)).toBe(reminderNotificationId('rec-1', 'appt-1day', 3));
  });

  it('a different schedule version produces a different identifier', () => {
    expect(reminderNotificationId('rec-1', 'appt-1day', 1)).not.toBe(reminderNotificationId('rec-1', 'appt-1day', 2));
  });

  it('a snooze identifier is namespaced separately from the original occasion identifier', () => {
    const original = reminderNotificationId('rec-1', 'appt-1day', 1);
    const snoozed = snoozeNotificationId('rec-1', 'appt-1day', 1, 123456);
    expect(snoozed).not.toBe(original);
  });
});

describe('Phase 14: conservative, lock-screen-safe content', () => {
  it('never includes notes or other potentially sensitive detail', () => {
    const record: LilicaRecord = {
      id: 'appt-5', type: 'appointment', title: 'Cardiology follow-up', status: 'scheduled',
      notes: 'Suspected condition X, confidential', createdAt: '2026-09-01T00:00:00.000Z',
    };
    const title = reminderTitle(record, 'Maggie');
    const body = reminderBody(record, 'appt-1day');
    expect(title).not.toMatch(/condition|confidential/i);
    expect(body).not.toMatch(/condition|confidential/i);
    expect(title).toBe("Maggie's appointment");
  });
});
