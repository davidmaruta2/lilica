import { fireEvent, render } from '@testing-library/react-native';

import { RecordQuickEditor } from '../src/components/RecordQuickEditor';
import { LilicaRecord } from '../src/types';

// Phase 21C: the Edit affordance on an existing record's detail stays
// VISIBLE while the care space is read-only -- never silently hidden,
// per the brief's explicit "do not silently disable with no explanation"
// requirement -- but tapping it shows the shared read-only gate instead
// of actually entering edit mode. A brand-new draft is gated upstream
// (at the point the caller decides to open one at all), so this is only
// ever about an EXISTING record's Edit trigger.

const baseProps = {
  supportedPersonId: 'person-1',
  careSpaceId: 'space-1',
  onSaveRecord: jest.fn(),
  onRemoveRecord: jest.fn(),
  onDismiss: jest.fn(),
};

const existing: LilicaRecord = {
  id: 'appt-1', type: 'appointment', title: 'Dentist', status: 'scheduled',
  eventDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z',
};

describe('RecordQuickEditor: Phase 21C read-only gating on Edit', () => {
  it('Edit stays visible when read-only, but tapping it calls onBlockedEdit instead of entering edit mode', async () => {
    const onBlockedEdit = jest.fn();
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[existing]} recordId="appt-1" isReadOnly onBlockedEdit={onBlockedEdit} onSaveRecord={jest.fn()} />,
    );
    // Visible, never hidden.
    screen.getByLabelText('Edit Dentist');
    fireEvent.press(screen.getByLabelText('Edit Dentist'));
    expect(onBlockedEdit).toHaveBeenCalledTimes(1);
    // Never actually entered edit mode.
    expect(screen.queryByText('Save changes')).toBeNull();
    expect(screen.queryByDisplayValue('Dentist')).toBeNull();
  });

  it('when not read-only, Edit works exactly as before (no regression)', async () => {
    const onBlockedEdit = jest.fn();
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[existing]} recordId="appt-1" isReadOnly={false} onBlockedEdit={onBlockedEdit} onSaveRecord={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText('Edit Dentist'));
    screen.getByDisplayValue('Dentist');
    expect(onBlockedEdit).not.toHaveBeenCalled();
  });

  it('a viewer (no edit capability at all) still sees no Edit button regardless of read-only state', async () => {
    const members = [
      { membershipId: 'm-viewer', displayName: 'Sarah', role: 'viewer' as const, relationshipType: 'Other relative' as const, isSelf: true, grantedDomains: ['general' as const] },
    ];
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[existing]} recordId="appt-1" careCircleMembers={members} isReadOnly onSaveRecord={jest.fn()} />,
    );
    expect(screen.queryByLabelText('Edit Dentist')).toBeNull();
  });
});
