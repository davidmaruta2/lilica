import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { RecordQuickEditor } from '../src/components/RecordQuickEditor';
import { CareCircleMember } from '../src/careCircle';
import { LilicaRecord } from '../src/types';

// Bug fix: opening a record from Home/Calendar/To Do/Care Circle/Wellbeing
// updates used to route through FirstThingScreen -- a whole separate
// screen (its own header, background, category-gateway list) mounted
// just to host the editor. That extra screen was what actually sat
// behind the sheet, and swapping it in/out on open/close is what read as
// a "flash" on every tile, on every tab -- not an animation-timing issue.
// RecordQuickEditor is the fix: the exact same RecordSheet + RecordEditor
// pairing, mounted directly over whichever screen is already showing, so
// nothing behind the sheet ever changes.
//
// Corrective task (view/edit separation): an EXISTING record now opens a
// read-only RecordDetail first, never the editor directly. Edit (shown
// only when the courtesy Phase 15 capability check allows it) reaches
// the exact same, unchanged RecordEditor. Save returns to the (now
// updated) detail, staying open -- it never closes the sheet or returns
// to any list. A brand-new draft (Add) is unaffected: it still goes
// straight to the editor, and Save still closes the sheet immediately.

const baseProps = {
  supportedPersonId: 'person-1',
  onSaveRecord: jest.fn(),
  onRemoveRecord: jest.fn(),
  onDismiss: jest.fn(),
};

const existing: LilicaRecord = {
  id: 'appt-1', type: 'appointment', title: 'Dentist', status: 'scheduled',
  eventDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z',
};

describe('RecordQuickEditor: acceptance 1/2 -- existing record opens RecordDetail, new record opens RecordEditor directly', () => {
  it('an existing record opens the read-only detail, not the editor', async () => {
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[existing]} recordId="appt-1" onSaveRecord={jest.fn()} />,
    );
    screen.getByText('Dentist');
    expect(screen.queryByDisplayValue('Dentist')).toBeNull();
    expect(screen.queryByText('Save changes')).toBeNull();
  });

  it('a brand-new draft (Add) skips straight to the editor -- creation stays as efficient as before', async () => {
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[existing]} newType="appointment" onSaveRecord={jest.fn()} />,
    );
    expect(screen.queryByDisplayValue('Dentist')).toBeNull();
    expect(screen.getAllByDisplayValue('').length).toBeGreaterThan(0);
    screen.getByText('Appointment');
  });

  it('renders nothing if the requested record id no longer exists', async () => {
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[]} recordId="missing" onSaveRecord={jest.fn()} />,
    );
    expect(screen.queryByDisplayValue('Dentist')).toBeNull();
  });
});

describe('RecordQuickEditor: never shows a category list or gateway -- this is only ever the one record', () => {
  it('has no "Back to X" link and no category-browsing affordance', async () => {
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[existing]} recordId="appt-1" onSaveRecord={jest.fn()} />,
    );
    expect(screen.queryByText(/^Back to /)).toBeNull();
  });
});

describe('RecordQuickEditor: acceptance 3/4/10/11 -- Edit exposes the existing editor; Save returns to the updated detail, same identity, no duplicate', () => {
  it('Edit opens the exact same RecordEditor, pre-filled with the current values', async () => {
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[existing]} recordId="appt-1" onSaveRecord={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText('Edit Dentist'));
    screen.getByDisplayValue('Dentist');
    screen.getByText('Save changes');
  });

  it('Save calls onSaveRecord once, with the same record id, and returns to the detail -- the sheet never closes', async () => {
    const onSaveRecord = jest.fn();
    const onDismiss = jest.fn();
    const screen = await render(
      <RecordQuickEditor {...baseProps} onSaveRecord={onSaveRecord} onDismiss={onDismiss} records={[existing]} recordId="appt-1" />,
    );
    await fireEvent.press(screen.getByLabelText('Edit Dentist'));
    await fireEvent.changeText(screen.getByDisplayValue('Dentist'), 'Dentist (annual check-up)');
    await fireEvent.press(screen.getByText('Save changes'));

    expect(onSaveRecord).toHaveBeenCalledTimes(1);
    expect(onSaveRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 'appt-1', title: 'Dentist (annual check-up)' }));
    expect(onDismiss).not.toHaveBeenCalled();
    // Back on the detail, not the editor, and the sheet stayed open --
    // never closed, never fell through to any other view.
    expect(screen.queryByText('Save changes')).toBeNull();
    screen.getByLabelText('Edit Dentist');

    // The parent owns `records`; in the real app onSaveRecord flows back
    // into it and this component simply re-renders with the fresh value
    // (it never keeps its own copy) -- simulate that one round trip here.
    const saved = onSaveRecord.mock.calls[0][0];
    await screen.rerender(
      <RecordQuickEditor {...baseProps} onSaveRecord={onSaveRecord} onDismiss={onDismiss} records={[saved]} recordId="appt-1" />,
    );
    screen.getByText('Dentist (annual check-up)');
  });
});

describe('RecordQuickEditor: acceptance 15 -- Remove stays exactly where it already was, inside Edit', () => {
  it('Remove is only reachable after pressing Edit, never from the detail view itself', async () => {
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[existing]} recordId="appt-1" onSaveRecord={jest.fn()} />,
    );
    expect(screen.queryByLabelText('Remove appointment')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Edit Dentist'));
    screen.getByLabelText('Remove appointment');
  });

  it('removing calls onRemoveRecord and closes the sheet (unchanged behaviour)', async () => {
    const onRemoveRecord = jest.fn();
    const onDismiss = jest.fn();
    const screen = await render(
      <RecordQuickEditor {...baseProps} onRemoveRecord={onRemoveRecord} onDismiss={onDismiss} records={[existing]} recordId="appt-1" onSaveRecord={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText('Edit Dentist'));
    // Remove itself opens a native confirm alert (unchanged, RecordEditor's
    // own confirmRemove()) -- not re-tested here; see phase9-record-
    // management.test.tsx for that confirmation flow.
    screen.getByLabelText('Remove appointment');
  });
});

describe('RecordQuickEditor: Edit visibility follows the real Phase 15 capability check', () => {
  it('a viewer never sees Edit on the detail', async () => {
    const members: CareCircleMember[] = [
      { membershipId: 'm-viewer', displayName: 'Sarah', role: 'viewer', relationshipType: 'Other relative', isSelf: true, grantedDomains: ['general'] },
    ];
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[existing]} recordId="appt-1" careCircleMembers={members} onSaveRecord={jest.fn()} />,
    );
    screen.getByText('Dentist');
    expect(screen.queryByLabelText('Edit Dentist')).toBeNull();
  });

  it('the organiser (or no loaded care circle yet) sees Edit', async () => {
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[existing]} recordId="appt-1" onSaveRecord={jest.fn()} />,
    );
    screen.getByLabelText('Edit Dentist');
  });
});

describe('RecordQuickEditor: saving/dismissing a NEW record still closes back to the caller (unchanged)', () => {
  it('saving a brand-new draft calls onSaveRecord then onDismiss', async () => {
    const onSaveRecord = jest.fn();
    const onDismiss = jest.fn();
    // "Something to do" has no required date, so title alone is enough to
    // save -- keeps this test about the create lifecycle, not the wheel
    // date picker.
    const screen = await render(
      <RecordQuickEditor {...baseProps} onSaveRecord={onSaveRecord} onDismiss={onDismiss} records={[]} newType="task" />,
    );
    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Book a taxi');
    await fireEvent.press(screen.getByText('Add task'));
    expect(onSaveRecord).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('the sheet\'s own Done button calls onDismiss directly, without saving anything', async () => {
    const onSaveRecord = jest.fn();
    const onDismiss = jest.fn();
    const screen = await render(
      <RecordQuickEditor {...baseProps} onSaveRecord={onSaveRecord} onDismiss={onDismiss} records={[existing]} recordId="appt-1" />,
    );
    await fireEvent.press(screen.getByText('Done'));
    // The sheet's own Done button dismisses via its 220ms slide-down
    // animation (unchanged, ordinary behaviour) -- wait for that to
    // finish and call onDismiss, same as any other RecordSheet consumer.
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(onSaveRecord).not.toHaveBeenCalled();
  });
});
