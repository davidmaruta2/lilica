import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { RecordQuickEditor } from '../src/components/RecordQuickEditor';
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

const baseProps = {
  supportedPersonId: 'person-1',
  onSaveRecord: jest.fn(),
  onRemoveRecord: jest.fn(),
  onDismiss: jest.fn(),
};

describe('RecordQuickEditor: opens the SAME existing record for editing, not a new draft', () => {
  it('shows the existing record\'s own fields', async () => {
    const existing: LilicaRecord = {
      id: 'appt-1', type: 'appointment', title: 'Dentist', status: 'scheduled',
      eventDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[existing]} recordId="appt-1" onSaveRecord={jest.fn()} />,
    );
    screen.getByDisplayValue('Dentist');
  });

  it('renders nothing if the requested record id no longer exists', async () => {
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[]} recordId="missing" onSaveRecord={jest.fn()} />,
    );
    expect(screen.queryByDisplayValue('Dentist')).toBeNull();
  });
});

describe('RecordQuickEditor: opens a blank draft when asked for a new record of a type', () => {
  it('opens an empty appointment editor, not any existing record', async () => {
    const existing: LilicaRecord = {
      id: 'appt-1', type: 'appointment', title: 'Dentist', status: 'scheduled',
      eventDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[existing]} newType="appointment" onSaveRecord={jest.fn()} />,
    );
    expect(screen.queryByDisplayValue('Dentist')).toBeNull();
    screen.getByText('Appointment');
  });
});

describe('RecordQuickEditor: never shows a category list or gateway -- this is only ever the one record', () => {
  it('has no "Back to X" link and no category-browsing affordance', async () => {
    const existing: LilicaRecord = {
      id: 'appt-1', type: 'appointment', title: 'Dentist', status: 'scheduled',
      eventDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[existing]} recordId="appt-1" onSaveRecord={jest.fn()} />,
    );
    expect(screen.queryByText(/^Back to /)).toBeNull();
  });
});

describe('RecordQuickEditor: saving/removing/dismissing all close back to the caller', () => {
  const existing: LilicaRecord = {
    id: 'appt-1', type: 'appointment', title: 'Dentist', status: 'scheduled',
    eventDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z',
  };

  it('saving calls onSaveRecord then onDismiss', async () => {
    const onSaveRecord = jest.fn();
    const onDismiss = jest.fn();
    const screen = await render(
      <RecordQuickEditor {...baseProps} onSaveRecord={onSaveRecord} onDismiss={onDismiss} records={[existing]} recordId="appt-1" />,
    );
    await fireEvent.press(screen.getByText('Save changes'));
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
