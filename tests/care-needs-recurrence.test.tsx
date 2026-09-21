// Daily/weekly recurring care needs, 21 September 2026 (see
// docs/CARE_NEEDS_REDESIGN_SKETCH_2026-09-21.txt). Care needs' kind
// (support need vs preference/routine), optional recurrence, and the
// rollover-on-completion mechanism this feature is built on -- the first
// time any recurring record in the app actually advances to its next
// period when marked done, rather than staying permanently completed.
import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { createRecordDraft, RecordDraft, RecordEditor } from '../src/components/RecordEditor';
import { isReminderEligible } from '../src/reminders';
import { advanceRecurrence, careNeedCadenceLabel, isActionableRecord } from '../src/records';
import { LilicaRecord, LilicaRecordType } from '../src/types';

function RecordEditorHarness(props: {
  type: LilicaRecordType;
  record?: LilicaRecord;
  supportedPersonId: string;
  onSave: (record: LilicaRecord) => void;
}) {
  const [draft, setDraft] = useState<RecordDraft>(createRecordDraft(props.type, props.record));
  return <RecordEditor {...props} draft={draft} onChange={setDraft} />;
}

describe('advanceRecurrence (records.ts) -- the actual rollover mechanism', () => {
  it('advances by day/week/month/year correctly', () => {
    expect(advanceRecurrence('2026-09-21', { interval: 1, unit: 'day' })).toBe('2026-09-22');
    expect(advanceRecurrence('2026-09-21', { interval: 3, unit: 'day' })).toBe('2026-09-24');
    expect(advanceRecurrence('2026-09-21', { interval: 1, unit: 'week' })).toBe('2026-09-28');
    expect(advanceRecurrence('2026-01-31', { interval: 1, unit: 'month' })).toBe('2026-03-03'); // JS Date month-overflow, same behaviour addRecurrence already had for month/year
    expect(advanceRecurrence('2026-09-21', { interval: 1, unit: 'year' })).toBe('2027-09-21');
  });

  it('returns undefined for an invalid or missing date, never a fabricated one', () => {
    expect(advanceRecurrence('', { interval: 1, unit: 'day' })).toBeUndefined();
    expect(advanceRecurrence('not-a-date', { interval: 1, unit: 'day' })).toBeUndefined();
  });
});

describe('isActionableRecord / isReminderEligible -- recurring care needs only', () => {
  const base: LilicaRecord = {
    id: 'n1',
    type: 'careNote',
    title: 'Help with bathing',
    createdAt: '2026-09-01T00:00:00.000Z',
  };

  it('a recurring support need is actionable and reminder-eligible', () => {
    const record: LilicaRecord = { ...base, careNoteKind: 'need', recurrence: { interval: 1, unit: 'day' } };
    expect(isActionableRecord(record)).toBe(true);
    expect(isReminderEligible(record)).toBe(true);
  });

  it('a preference/routine note is never actionable or reminder-eligible, even with a recurrence set', () => {
    const record: LilicaRecord = { ...base, careNoteKind: 'preference', recurrence: { interval: 1, unit: 'day' } };
    expect(isActionableRecord(record)).toBe(false);
    expect(isReminderEligible(record)).toBe(false);
  });

  it('a support need with no recurrence chosen stays purely informational', () => {
    const record: LilicaRecord = { ...base, careNoteKind: 'need' };
    expect(isActionableRecord(record)).toBe(false);
    expect(isReminderEligible(record)).toBe(false);
  });

  it('a cancelled recurring need is never actionable', () => {
    const record: LilicaRecord = { ...base, careNoteKind: 'need', recurrence: { interval: 1, unit: 'day' }, status: 'cancelled' };
    expect(isActionableRecord(record)).toBe(false);
  });

  it('an ordinary task/bill/homeMatter is unaffected by this change', () => {
    expect(isActionableRecord({ ...base, type: 'task', careNoteKind: undefined })).toBe(true);
  });
});

describe('RecordEditor: care need kind and recurrence UI', () => {
  it('a new careNote defaults to Support need and offers Daily/Weekly/Fortnightly/Monthly only', async () => {
    const onSave = jest.fn();
    const screen = await render(<RecordEditorHarness type="careNote" supportedPersonId="p1" onSave={onSave} />);
    screen.getByText('Support need');
    screen.getByText('Start date'); // relabeled from the generic "Date", 22 September 2026
    screen.getByText('Daily');
    screen.getByText('Weekly');
    screen.getByText('Fortnightly');
    screen.getByText('Monthly');
    expect(screen.queryByText('Bi-weekly')).toBeNull(); // the bill/homeMatter-only options never leak in
    expect(screen.queryByText('6-monthly')).toBeNull();
    expect(screen.queryByText('Annually')).toBeNull();
  });

  it('an end date field only appears once a recurrence is actually chosen', async () => {
    const onSave = jest.fn();
    const screen = await render(<RecordEditorHarness type="careNote" supportedPersonId="p1" onSave={onSave} />);
    expect(screen.queryByText('End date')).toBeNull();
    await fireEvent.press(screen.getByText('Daily'));
    screen.getByText('End date');
  });

  it('switching to Preference or routine hides the recurrence picker and clears any chosen recurrence', async () => {
    const onSave = jest.fn();
    const screen = await render(<RecordEditorHarness type="careNote" supportedPersonId="p1" onSave={onSave} />);
    await fireEvent.press(screen.getByText('Daily'));
    await fireEvent.press(screen.getByText('Preference or routine'));
    expect(screen.queryByText('Repeats')).toBeNull();
    expect(screen.queryByText('Done today')).toBeNull();
  });

  it('a support need with no recurrence chosen shows no completion control yet', async () => {
    const onSave = jest.fn();
    const screen = await render(<RecordEditorHarness type="careNote" supportedPersonId="p1" onSave={onSave} />);
    expect(screen.queryByText('Done today')).toBeNull();
    expect(screen.queryByText('Done this week')).toBeNull();
  });

  it('the completion label matches the chosen cadence for all four options', async () => {
    const onSave = jest.fn();
    const screen = await render(<RecordEditorHarness type="careNote" supportedPersonId="p1" onSave={onSave} />);
    await fireEvent.press(screen.getByText('Daily'));
    screen.getByText('Done today');
    await fireEvent.press(screen.getByText('Weekly'));
    screen.getByText('Done this week');
    await fireEvent.press(screen.getByText('Fortnightly'));
    screen.getByText('Done this fortnight');
    await fireEvent.press(screen.getByText('Monthly'));
    screen.getByText('Done this month');
  });
});

describe('RecordEditor: rollover on completion -- the core new mechanism', () => {
  it('marking a daily care need done advances it to tomorrow instead of leaving it permanently completed', async () => {
    const onSave = jest.fn();
    const record: LilicaRecord = {
      id: 'need-1',
      type: 'careNote',
      title: 'Help with bathing',
      careNoteKind: 'need',
      eventDate: '2026-09-21',
      recurrence: { interval: 1, unit: 'day' },
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(<RecordEditorHarness type="careNote" record={record} supportedPersonId="p1" onSave={onSave} />);
    await fireEvent.press(screen.getByText('Done today'));
    await fireEvent.press(screen.getByText('Save changes'));
    const saved = onSave.mock.calls[0][0] as LilicaRecord;
    // Rolled forward, not left completed: this is the whole point -- a
    // recurring need that's done today comes back tomorrow, undone again,
    // ready to be flagged if nobody acts on it.
    expect(saved.completed).toBe(false);
    expect(saved.eventDate).toBe('2026-09-22');
    // But the fact it WAS done just now is still recorded.
    expect(typeof saved.completedAt).toBe('string');
    expect(saved.confirmationHistory?.length).toBe(1);
  });

  it('marking a weekly care need done advances it by a week', async () => {
    const onSave = jest.fn();
    const record: LilicaRecord = {
      id: 'need-2',
      type: 'careNote',
      title: 'Grocery shop together',
      careNoteKind: 'need',
      eventDate: '2026-09-21',
      recurrence: { interval: 1, unit: 'week' },
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(<RecordEditorHarness type="careNote" record={record} supportedPersonId="p1" onSave={onSave} />);
    await fireEvent.press(screen.getByText('Done this week'));
    await fireEvent.press(screen.getByText('Save changes'));
    const saved = onSave.mock.calls[0][0] as LilicaRecord;
    expect(saved.completed).toBe(false);
    expect(saved.eventDate).toBe('2026-09-28');
  });

  it('not marking it done leaves the date untouched (no rollover without completion)', async () => {
    const onSave = jest.fn();
    const record: LilicaRecord = {
      id: 'need-3',
      type: 'careNote',
      title: 'Help with bathing',
      careNoteKind: 'need',
      eventDate: '2026-09-21',
      recurrence: { interval: 1, unit: 'day' },
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(<RecordEditorHarness type="careNote" record={record} supportedPersonId="p1" onSave={onSave} />);
    await fireEvent.press(screen.getByText('Save changes'));
    const saved = onSave.mock.calls[0][0] as LilicaRecord;
    expect(saved.eventDate).toBe('2026-09-21');
    expect(saved.completed).toBe(false);
  });
});

describe('careNeedCadenceLabel (records.ts) -- shared wording for editor + To Do', () => {
  it('covers all four offered recurrence options plus sensible fallbacks', () => {
    expect(careNeedCadenceLabel({ interval: 1, unit: 'day' })).toBe('today');
    expect(careNeedCadenceLabel({ interval: 1, unit: 'week' })).toBe('this week');
    expect(careNeedCadenceLabel({ interval: 2, unit: 'week' })).toBe('this fortnight');
    expect(careNeedCadenceLabel({ interval: 1, unit: 'month' })).toBe('this month');
    expect(careNeedCadenceLabel({ interval: 3, unit: 'day' })).toBe('every 3 days');
    expect(careNeedCadenceLabel({ interval: 3, unit: 'week' })).toBe('every 3 weeks');
    expect(careNeedCadenceLabel(undefined)).toBe('this period');
  });
});

describe('RecordEditor: care need end date', () => {
  it('shows the field, pre-filled, and round-trips an existing end date on save', async () => {
    // DateTimeWheelField is a press-to-open wheel sheet, not a text input --
    // proven here the same way the existing condition/medicine date tests
    // above do it (a pre-set record, not simulating wheel interaction).
    const onSave = jest.fn();
    const record: LilicaRecord = {
      id: 'need-4',
      type: 'careNote',
      title: 'Wound care',
      careNoteKind: 'need',
      eventDate: '2026-09-21',
      recurrence: { interval: 1, unit: 'day' },
      careNoteEndDate: '2026-10-15',
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(<RecordEditorHarness type="careNote" record={record} supportedPersonId="p1" onSave={onSave} />);
    screen.getByLabelText(/^End date: 15\/10\/2026/);
    await fireEvent.press(screen.getByText('Save changes'));
    const saved = onSave.mock.calls[0][0] as LilicaRecord;
    expect(saved.careNoteEndDate).toBe('2026-10-15');
  });

  it('switching to Preference or routine clears any end date, matching the recurrence clear', async () => {
    const onSave = jest.fn();
    const record: LilicaRecord = {
      id: 'need-5',
      type: 'careNote',
      title: 'Wound care',
      careNoteKind: 'need',
      eventDate: '2026-09-21',
      recurrence: { interval: 1, unit: 'day' },
      careNoteEndDate: '2026-10-15',
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(<RecordEditorHarness type="careNote" record={record} supportedPersonId="p1" onSave={onSave} />);
    await fireEvent.press(screen.getByText('Preference or routine'));
    await fireEvent.press(screen.getByText('Save changes'));
    const saved = onSave.mock.calls[0][0] as LilicaRecord;
    expect(saved.careNoteEndDate).toBeUndefined();
    expect(saved.recurrence).toBeUndefined();
  });
});

describe('isActionableRecord / isReminderEligible: careNoteEndDate gating', () => {
  const base: LilicaRecord = {
    id: 'n2',
    type: 'careNote',
    title: 'Wound care',
    careNoteKind: 'need',
    recurrence: { interval: 1, unit: 'day' },
    createdAt: '2026-09-01T00:00:00.000Z',
  };

  it('a need with a future end date stays actionable', () => {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 1);
    const record: LilicaRecord = { ...base, careNoteEndDate: farFuture.toISOString().slice(0, 10) };
    expect(isActionableRecord(record)).toBe(true);
    expect(isReminderEligible(record)).toBe(true);
  });

  it('a need past its own end date stops being actionable, without needing to be closed', () => {
    const record: LilicaRecord = { ...base, careNoteEndDate: '2020-01-01' };
    expect(isActionableRecord(record)).toBe(false);
    expect(isReminderEligible(record)).toBe(false);
    expect(record.closedAt).toBeUndefined(); // never auto-closed, per types.ts's careNoteEndDate comment
  });

  it('a need with no end date at all is unaffected (the common case)', () => {
    expect(isActionableRecord(base)).toBe(true);
  });
});
