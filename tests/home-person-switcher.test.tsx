import { fireEvent, render } from '@testing-library/react-native';

import { HomeScreen } from '../src/screens/HomeScreen';
import { initialOnboardingState } from '../src/storage';
import { LilicaRecord, LocalCareSpaceState } from '../src/types';

// Corrective task 3: the switcher card's affordance changed, but it must
// still open the EXISTING PersonSwitcher and drive the EXISTING
// care-space-switching path -- nothing about switching itself changed.

function person(overrides: Partial<LocalCareSpaceState>): LocalCareSpaceState {
  return {
    careSpaceId: 'space-a',
    supportedPersonId: 'person-a',
    bootstrapId: 'bootstrap-a',
    relationshipType: 'Mum',
    displayName: 'Maggie',
    privacyDeclarationAccepted: true,
    interests: [],
    records: [],
    setupStatus: 'ready',
    allSetDismissed: true,
    ...overrides,
  };
}

describe('Home person switcher card', () => {
  it('opens the existing PersonSwitcher on tap, listing every person', async () => {
    const maggie = person({ careSpaceId: 'space-a', displayName: 'Maggie' });
    const jackie = person({ careSpaceId: 'space-b', supportedPersonId: 'person-b', bootstrapId: 'bootstrap-b', displayName: 'Jackie' });
    const screen = await render(
      <HomeScreen
        state={{ ...initialOnboardingState, stage: 'home', supportedPersonName: 'Maggie', allSetDismissed: true }}
        people={[maggie, jackie]}
        activeCareSpaceId="space-a"
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
        onSwitchPerson={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Switch person, currently Maggie'));
    screen.getByText('People you\'re helping');
    screen.getByText('Maggie');
    screen.getByText('Jackie');
  });

  it('selecting a different person calls onSwitchPerson with THAT care space id -- switching logic itself is untouched', async () => {
    const maggie = person({ careSpaceId: 'space-a', displayName: 'Maggie' });
    const jackie = person({ careSpaceId: 'space-b', supportedPersonId: 'person-b', bootstrapId: 'bootstrap-b', displayName: 'Jackie' });
    const onSwitchPerson = jest.fn();
    const screen = await render(
      <HomeScreen
        state={{ ...initialOnboardingState, stage: 'home', supportedPersonName: 'Maggie', allSetDismissed: true }}
        people={[maggie, jackie]}
        activeCareSpaceId="space-a"
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
        onSwitchPerson={onSwitchPerson}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Switch person, currently Maggie'));
    await fireEvent.press(screen.getByText('Jackie'));
    expect(onSwitchPerson).toHaveBeenCalledWith('space-b');
    expect(onSwitchPerson).toHaveBeenCalledTimes(1);
  });

  it('after switching, Home completely reflects the newly selected care space -- different name and different records, nothing from the old one leaking through', async () => {
    const maggiesAppointment: LilicaRecord = {
      id: 'maggie-appt', type: 'appointment', title: "Maggie's dentist", status: 'scheduled',
      eventDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z',
    };
    const jackiesTask: LilicaRecord = {
      id: 'jackie-task', type: 'task', title: "Jackie's shopping", status: 'unresolved',
      dueDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z',
    };
    const maggie = person({ careSpaceId: 'space-a', displayName: 'Maggie', records: [maggiesAppointment] });
    const jackie = person({ careSpaceId: 'space-b', supportedPersonId: 'person-b', bootstrapId: 'bootstrap-b', displayName: 'Jackie', records: [jackiesTask] });

    // Before switching: Maggie's context, Maggie's record, no sign of Jackie.
    const screen = await render(
      <HomeScreen
        state={{ ...initialOnboardingState, stage: 'home', supportedPersonName: 'Maggie', records: maggie.records, allSetDismissed: true }}
        people={[maggie, jackie]}
        activeCareSpaceId="space-a"
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
        onSwitchPerson={jest.fn()}
      />,
    );
    screen.getByLabelText('Switch person, currently Maggie');
    screen.getByText("Maggie's dentist");
    expect(screen.queryByText("Jackie's shopping")).toBeNull();

    // Simulate exactly what App.tsx's selectActiveSpace/activeCareSpaceId
    // transition produces once onSwitchPerson('space-b') is handled --
    // the same state shape, now pointed at Jackie's care space.
    await screen.rerender(
      <HomeScreen
        state={{ ...initialOnboardingState, stage: 'home', supportedPersonName: 'Jackie', records: jackie.records, allSetDismissed: true }}
        people={[maggie, jackie]}
        activeCareSpaceId="space-b"
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
        onSwitchPerson={jest.fn()}
      />,
    );

    // After switching: Home is completely Jackie's -- her name, her
    // record, and Maggie's record and context are entirely gone.
    screen.getByLabelText('Switch person, currently Jackie');
    screen.getByText("Jackie's shopping");
    expect(screen.queryByText("Maggie's dentist")).toBeNull();
    expect(screen.queryByLabelText('Switch person, currently Maggie')).toBeNull();
  });
});
