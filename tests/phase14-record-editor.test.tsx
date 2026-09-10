import { fireEvent, render } from '@testing-library/react-native';

import { createRecordDraft, RecordEditor } from '../src/components/RecordEditor';
import { LilicaRecord } from '../src/types';

// Phase 14: the record editor's minimum reminder affordance -- gated
// behind permission, and the schedule-version bump that drives
// reconciliation, without touching anything else about the editor.

describe('Phase 14: "Remind me" toggle', () => {
  it('appears for appointment/task/bill/homeMatter, not for document/contact/careNote/update', async () => {
    for (const type of ['appointment', 'task', 'bill', 'homeMatter'] as const) {
      const draft = createRecordDraft(type);
      const screen = await render(<RecordEditor type={type} draft={draft} supportedPersonId="p1" onChange={jest.fn()} onSave={jest.fn()} />);
      screen.getByText('Remind me');
    }
    for (const type of ['document', 'contact', 'careNote', 'update'] as const) {
      const draft = createRecordDraft(type);
      const screen = await render(<RecordEditor type={type} draft={draft} supportedPersonId="p1" onChange={jest.fn()} onSave={jest.fn()} />);
      expect(screen.queryByText('Remind me')).toBeNull();
    }
  });

  it('turning it on requests permission first; denial leaves it off', async () => {
    const onChange = jest.fn();
    const onRequestReminderPermission = jest.fn().mockResolvedValue(false);
    const draft = createRecordDraft('task');
    const screen = await render(
      <RecordEditor type="task" draft={draft} supportedPersonId="p1" onChange={onChange} onSave={jest.fn()} onRequestReminderPermission={onRequestReminderPermission} />,
    );
    await fireEvent.press(screen.getByText('Remind me'));
    expect(onRequestReminderPermission).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ remindersEnabled: true }));
  });

  it('turning it on succeeds once permission is granted', async () => {
    const onChange = jest.fn();
    const onRequestReminderPermission = jest.fn().mockResolvedValue(true);
    const draft = createRecordDraft('task');
    const screen = await render(
      <RecordEditor type="task" draft={draft} supportedPersonId="p1" onChange={onChange} onSave={jest.fn()} onRequestReminderPermission={onRequestReminderPermission} />,
    );
    await fireEvent.press(screen.getByText('Remind me'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ remindersEnabled: true }));
  });

  it('turning it off never requires permission', async () => {
    const onChange = jest.fn();
    const onRequestReminderPermission = jest.fn();
    const draft = { ...createRecordDraft('task'), remindersEnabled: true };
    const screen = await render(
      <RecordEditor type="task" draft={draft} supportedPersonId="p1" onChange={onChange} onSave={jest.fn()} onRequestReminderPermission={onRequestReminderPermission} />,
    );
    await fireEvent.press(screen.getByText('Remind me'));
    expect(onRequestReminderPermission).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ remindersEnabled: false }));
  });
});

describe('Phase 14: schedule version bumps only when the relevant date/time changes', () => {
  it('saving without changing the due date keeps the same schedule version', async () => {
    const existing: LilicaRecord = {
      id: 'bill-1', type: 'bill', title: 'Electricity', status: 'unresolved',
      dueDate: '2026-09-30', remindersEnabled: true, reminderScheduleVersion: 2,
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const onSave = jest.fn();
    const draft = createRecordDraft('bill', existing);
    const screen = await render(
      <RecordEditor type="bill" record={existing} draft={{ ...draft, notes: 'updated notes' }} supportedPersonId="p1" onChange={jest.fn()} onSave={onSave} />,
    );
    await fireEvent.press(screen.getByLabelText('Save changes'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ reminderScheduleVersion: 2 }));
  });

  it('changing the due date bumps the schedule version', async () => {
    const existing: LilicaRecord = {
      id: 'bill-1', type: 'bill', title: 'Electricity', status: 'unresolved',
      dueDate: '2026-09-30', remindersEnabled: true, reminderScheduleVersion: 2,
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const onSave = jest.fn();
    const draft = createRecordDraft('bill', existing);
    const screen = await render(
      <RecordEditor type="bill" record={existing} draft={{ ...draft, date: '05/10/2026' }} supportedPersonId="p1" onChange={jest.fn()} onSave={onSave} />,
    );
    await fireEvent.press(screen.getByLabelText('Save changes'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ reminderScheduleVersion: 3, dueDate: '2026-10-05' }));
  });
});
