import { fireEvent, render } from '@testing-library/react-native';

import { FirstThingScreen } from '../src/screens/FirstThingScreen';

// Phase 21C: FirstThingScreen is normally only reached via an already-
// gated Add action (App.tsx wraps its own "go to firstThing" calls in
// guardMutation), but it can stay mounted as the everyday Add-reuse
// surface, so its own internal "create a new record in this category"
// and "Edit an existing record" triggers are gated here too, as a second
// line of defence against a read-only transition mid-session.

const baseProps = {
  interests: [] as never[],
  personName: 'Margaret',
  supportedPersonId: 'person-1',
  careSpaceId: 'space-1',
  onBack: jest.fn(),
  onSaveRecord: jest.fn(),
  onRemoveRecord: jest.fn(),
  onFinish: jest.fn(),
  onSkip: jest.fn(),
};

describe('FirstThingScreen: Phase 21C read-only gating', () => {
  it('opening a category with no existing records (straight create) is blocked when read-only', async () => {
    const onBlockedMutation = jest.fn();
    const screen = await render(
      <FirstThingScreen {...baseProps} records={[]} everyday isReadOnly onBlockedMutation={onBlockedMutation} />,
    );
    await fireEvent.press(screen.getByLabelText('Add Appointment'));
    expect(onBlockedMutation).toHaveBeenCalledTimes(1);
    // Never actually entered the editor.
    expect(screen.queryByText('Add appointment')).toBeNull();
  });

  it('the category list\'s own "Add" button is blocked when read-only', async () => {
    const onBlockedMutation = jest.fn();
    const appointment = { id: 'a1', type: 'appointment' as const, title: 'Dentist', createdAt: '2026-09-10T00:00:00Z' };
    const screen = await render(
      <FirstThingScreen {...baseProps} records={[appointment]} everyday isReadOnly onBlockedMutation={onBlockedMutation} />,
    );
    await fireEvent.press(screen.getByLabelText('Open Appointment'));
    fireEvent.press(screen.getByText('Add appointment'));
    expect(onBlockedMutation).toHaveBeenCalledTimes(1);
  });

  it('an existing record\'s Edit affordance stays visible but is blocked when read-only', async () => {
    const onBlockedMutation = jest.fn();
    const appointment = { id: 'a1', type: 'appointment' as const, title: 'Dentist', createdAt: '2026-09-10T00:00:00Z' };
    const screen = await render(
      <FirstThingScreen {...baseProps} records={[appointment]} everyday isReadOnly onBlockedMutation={onBlockedMutation} />,
    );
    await fireEvent.press(screen.getByLabelText('Open Appointment'));
    await fireEvent.press(screen.getByText('Dentist'));
    screen.getByLabelText('Edit Dentist');
    fireEvent.press(screen.getByLabelText('Edit Dentist'));
    expect(onBlockedMutation).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Save changes')).toBeNull();
  });

  it('when not read-only, everything works exactly as before (no regression)', async () => {
    const onBlockedMutation = jest.fn();
    const screen = await render(
      <FirstThingScreen {...baseProps} records={[]} everyday isReadOnly={false} onBlockedMutation={onBlockedMutation} />,
    );
    await fireEvent.press(screen.getByLabelText('Add Appointment'));
    expect(screen.getAllByText('Appointment').length).toBeGreaterThan(0);
    expect(onBlockedMutation).not.toHaveBeenCalled();
  });
});
