import { deriveRecordState, formatDateForInput, toIsoDate } from '../src/records';
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
