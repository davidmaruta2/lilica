import { deriveRecordState, formatDateForInput, removeRecordById, toIsoDate, upsertRecord } from '../src/records';
import { clampDateParts, daysInMonth, formatWheelDate, formatWheelTime } from '../src/components/DateTimeWheelField';
import { LilicaRecord } from '../src/types';

function record(patch: Partial<LilicaRecord> = {}): LilicaRecord {
  return {
    id: 'record-1',
    type: 'task',
    title: 'Test record',
    createdAt: '2026-09-01T09:00:00.000Z',
    ...patch,
  };
}

describe('Phase 1 date parsing characterization', () => {
  test.each([
    ['09/09/2026', '2026-09-09'],
    ['9/9/2026', '2026-09-09'],
    ['2026-09-09', '2026-09-09'],
    ['31/02/2026', undefined],
    ['September 9', undefined],
  ])('toIsoDate(%s) returns %s', (input, expected) => {
    expect(toIsoDate(input)).toBe(expected);
  });

  it('formats stored ISO dates for the UK input', () => {
    expect(formatDateForInput('2026-09-09')).toBe('09/09/2026');
  });
});

describe('structured record multi-entry correction', () => {
  it('adds three records, edits only the second and removes only the first by ID', () => {
    const first = record({ id: 'appointment-1', type: 'appointment', title: 'Orthodontist', eventTime: '10:00' });
    const second = record({ id: 'appointment-2', type: 'appointment', title: 'GP appointment', eventTime: '14:30' });
    const third = record({ id: 'appointment-3', type: 'appointment', title: 'Dentist', eventTime: '09:15' });
    let records = [first, second, third].reduce(upsertRecord, [] as LilicaRecord[]);

    records = upsertRecord(records, { ...second, eventTime: '15:00' });
    expect(records).toHaveLength(3);
    expect(records.map((item) => item.eventTime)).toEqual(['10:00', '15:00', '09:15']);

    records = removeRecordById(records, first.id);
    expect(records).toEqual([{ ...second, eventTime: '15:00' }, third]);
  });
});

describe('Lilica date and time wheel logic', () => {
  it('handles leap years and safely clamps impossible days', () => {
    expect(daysInMonth(2, 2024)).toBe(29);
    expect(daysInMonth(2, 2026)).toBe(28);
    expect(clampDateParts({ day: 31, month: 2, year: 2024 })).toEqual({ day: 29, month: 2, year: 2024 });
    expect(clampDateParts({ day: 31, month: 2, year: 2026 })).toEqual({ day: 28, month: 2, year: 2026 });
  });

  it('formats UK dates and every minute in 24-hour time', () => {
    expect(formatWheelDate({ day: 9, month: 5, year: 2027 })).toBe('09/05/2027');
    expect(formatWheelTime({ hour: 0, minute: 0 })).toBe('00:00');
    expect(formatWheelTime({ hour: 9, minute: 5 })).toBe('09:05');
  });
});

describe('Phase 1 derived-state characterization', () => {
  const now = new Date(2026, 8, 9, 12, 0, 0);

  it('derives due today, overdue and upcoming from due dates', () => {
    expect(deriveRecordState(record({ dueDate: '2026-09-09', status: 'unresolved' }), now)).toMatchObject({ dueToday: true, overdue: false, upcoming: false });
    expect(deriveRecordState(record({ dueDate: '2026-09-08', status: 'unresolved' }), now)).toMatchObject({ dueToday: false, overdue: true, upcoming: false });
    expect(deriveRecordState(record({ dueDate: '2026-09-10', status: 'unresolved' }), now)).toMatchObject({ dueToday: false, overdue: false, upcoming: true });
  });

  it('treats either completed flag or completed status as complete', () => {
    expect(deriveRecordState(record({ dueDate: '2026-09-01', completed: true }), now).completed).toBe(true);
    expect(deriveRecordState(record({ dueDate: '2026-09-01', status: 'completed' }), now).completed).toBe(true);
  });

  it('currently categorises a passed appointment as overdue', () => {
    const result = deriveRecordState(record({ type: 'appointment', status: 'scheduled', eventDate: '2026-09-08' }), now);
    expect(result.overdue).toBe(true);
  });

  it('currently calculates recurrence by mutating a JavaScript calendar date', () => {
    const result = deriveRecordState(record({
      type: 'bill',
      status: 'completed',
      completed: true,
      dueDate: '2026-01-31',
      recurrence: { interval: 1, unit: 'month' },
    }), now);
    expect(result.nextDueDate).toBe('2026-03-03');
  });

  it('uses a rolling seven-day recently-updated window', () => {
    const boundary = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const justOutside = new Date(now.getTime() - 7 * 86_400_000 - 1).toISOString();
    expect(deriveRecordState(record({ updatedAt: boundary }), now).recentlyUpdated).toBe(true);
    expect(deriveRecordState(record({ updatedAt: justOutside }), now).recentlyUpdated).toBe(false);
  });
});
