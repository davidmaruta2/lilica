import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { AuthScreen } from '../src/screens/AuthScreen';
import { EmailAuthScreen } from '../src/screens/EmailAuthScreen';
import { FirstThingScreen } from '../src/screens/FirstThingScreen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { InterestsScreen } from '../src/screens/InterestsScreen';
import { NameScreen } from '../src/screens/NameScreen';
import { PrivacyConsentScreen, PRIVACY_DECLARATION_VERSION } from '../src/screens/PrivacyConsentScreen';
import { RelationshipScreen } from '../src/screens/RelationshipScreen';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { initialOnboardingState } from '../src/storage';
import { LilicaRecord, LilicaRecordType } from '../src/types';

describe('protected Phase 1 onboarding surfaces', () => {
  it('retains the three-page Welcome journey and its entry actions', async () => {
    const onStart = jest.fn();
    const onLogin = jest.fn();
    const screen = await render(<WelcomeScreen onStart={onStart} onLogin={onLogin} />);

    screen.getByText('Care for the people you love');
    await fireEvent.press(screen.getByText('Log in'));
    expect(onLogin).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByLabelText('Go to the next introduction page'));
    expect(screen.getByLabelText('Intro page 2 of 3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Go to the next introduction page'));
    expect(screen.getByLabelText('Intro page 3 of 3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Get started'));
    expect(onStart).toHaveBeenCalledTimes(1);
  }, 15_000);

  it('uses the approved email-only account choice and validates credentials', async () => {
    const onEmail = jest.fn();
    const onLogin = jest.fn();
    const auth = await render(<AuthScreen onBack={jest.fn()} onCreateAccount={onEmail} onLogIn={onLogin} />);
    await fireEvent.press(auth.getByLabelText('Continue with email'));
    expect(onEmail).toHaveBeenCalledTimes(1);
    expect(auth.queryByText('Continue with Apple')).toBeNull();

    const onSubmit = jest.fn().mockResolvedValue({ ok: true, verificationRequired: true });
    const onVerificationRequired = jest.fn();
    const email = await render(
      <EmailAuthScreen
        mode="create"
        onBack={jest.fn()}
        onSubmit={onSubmit}
        onVerificationRequired={onVerificationRequired}
        onAuthenticated={jest.fn()}
        onForgotPassword={jest.fn()}
      />,
    );
    const continueButton = email.getByLabelText('Create account');
    expect(continueButton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(email.getByPlaceholderText('you@example.com'), 'david@example.com');
    await fireEvent.changeText(email.getByPlaceholderText('At least 8 characters'), 'password123');
    await fireEvent.press(email.getByLabelText('Create account'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('david@example.com', 'password123'));
    expect(onVerificationRequired).toHaveBeenCalledWith('david@example.com');
  });

  it('preserves relationship selection and supported-person naming', async () => {
    const onSelect = jest.fn();
    const relationship = await render(
      <RelationshipScreen selected={undefined} onBack={jest.fn()} onSelect={onSelect} onContinue={jest.fn()} />,
    );
    await fireEvent.press(relationship.getByText('Mum'));
    expect(onSelect).toHaveBeenCalledWith('Mum');

    const onChangeName = jest.fn();
    const onContinue = jest.fn();
    const name = await render(
      <NameScreen onBack={jest.fn()} onChangeName={onChangeName} onContinue={onContinue} />,
    );
    await fireEvent.changeText(name.getByDisplayValue(''), 'Margaret');
    expect(onChangeName).toHaveBeenCalledWith('Margaret');
  });

  it('keeps the privacy declaration version and active gate', async () => {
    expect(PRIVACY_DECLARATION_VERSION).toBe('privacy-basis-v2');
    const onToggleAccepted = jest.fn();
    const onContinue = jest.fn();
    const screen = await render(
      <PrivacyConsentScreen
        accepted={false}
        onBack={jest.fn()}
        onToggleAccepted={onToggleAccepted}
        onContinue={onContinue}
      />,
    );
    expect(screen.getByLabelText('Continue').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(onToggleAccepted).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Continue'));
    expect(onContinue).not.toHaveBeenCalled();
  });

  // Corrective task: the choices here are now the real canonical record
  // categories (minus Wellbeing update, not offered as an initial-setup
  // choice) -- never a separate, competing taxonomy.
  it('keeps all seven canonical setup choices, skipping, and selection callbacks', async () => {
    const onToggle = jest.fn();
    const onSkip = jest.fn();
    const screen = await render(
      <InterestsScreen
        selected={[]}
        personName="Margaret"
        onBack={jest.fn()}
        onToggle={onToggle}
        onContinue={jest.fn()}
        onSkip={onSkip}
      />,
    );
    screen.getByText('What do you help Margaret with?');
    [
      'Appointment',
      'Something to do',
      'Bill or renewal',
      'Home or car matter',
      'Important document',
      'Contact',
      'Care information',
    ].forEach((label) => screen.getByText(label));
    // Wellbeing update is a canonical category, but not an initial-setup
    // choice -- it remains fully available from Add once setup is done.
    expect(screen.queryByText('Wellbeing update')).toBeNull();
    await fireEvent.press(screen.getByText('Appointment'));
    expect(onToggle).toHaveBeenCalledWith('appointment');
    await fireEvent.press(screen.getByLabelText('Skip for now'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe('protected structured-record onboarding', () => {
  const props = {
    interests: [] as LilicaRecordType[],
    personName: 'Margaret',
    supportedPersonId: 'person-margaret',
    records: [] as LilicaRecord[],
    onBack: jest.fn(),
    onSaveRecord: jest.fn(),
    onRemoveRecord: jest.fn(),
    onFinish: jest.fn(),
    onSkip: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders the protected heading, skip route and all eight categories', async () => {
    const screen = await render(<FirstThingScreen {...props} />);
    screen.getByText("Let's get Margaret organised.");
    [
      'Appointment',
      'Something to do',
      'Bill or renewal',
      'Home or car matter',
      'Important document',
      'Contact',
      'Care information',
      'Wellbeing update',
    ].forEach((label) => screen.getByLabelText(`Add ${label}`));
    screen.getByText('A repair, service, MOT or maintenance job');
    await fireEvent.press(screen.getByLabelText("I'll add things later"));
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  // Corrective task, brief's own worked example: David selects
  // Appointments + Bills for Beauty and does not select Medication
  // (Care information). Initial setup (everyday false, the default
  // here) offers ONLY the chosen categories, in canonical order --
  // acceptance tests 2/3.
  it('offers only the chosen categories during initial setup (selecting Appointments/Bills; not Medication)', async () => {
    const screen = await render(<FirstThingScreen {...props} interests={['appointment', 'bill']} />);
    const categoryLabels = screen.getAllByRole('button')
      .map((item) => item.props.accessibilityLabel as string | undefined)
      .filter((label): label is string => Boolean(label?.startsWith('Add ')));
    expect(categoryLabels).toEqual(['Add Appointment', 'Add Bill or renewal']);
    expect(screen.queryByLabelText('Add Care information')).toBeNull();
  });

  // Acceptance test 4: after setup completes (everyday true), the exact
  // same unselected category (Care information/"Medication") is
  // nevertheless offered through the normal Add flow -- with no return
  // to onboarding and no profile-setting change (acceptance tests 4-6).
  it('the everyday Add flow always offers the complete category set, regardless of what was chosen during initial setup', async () => {
    const screen = await render(<FirstThingScreen {...props} everyday interests={['appointment', 'bill']} />);
    const categoryLabels = screen.getAllByRole('button')
      .map((item) => item.props.accessibilityLabel as string | undefined)
      .filter((label): label is string => Boolean(label?.startsWith('Add ')));
    expect(categoryLabels).toHaveLength(8);
    screen.getByLabelText('Add Care information');
  });

  // Acceptance test 5/6: a record CAN be created in a category that was
  // not selected during onboarding, without returning to onboarding --
  // proven directly against the everyday Add flow's own save path.
  it('a record can be created in a category that was not selected during onboarding', async () => {
    const onSaveRecord = jest.fn();
    const screen = await render(<FirstThingScreen {...props} everyday interests={['appointment', 'bill']} onSaveRecord={onSaveRecord} />);
    await fireEvent.press(screen.getByLabelText('Add Care information'));
    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Metformin');
    await fireEvent.press(screen.getByText('Add care information'));
    expect(onSaveRecord).toHaveBeenCalledWith(expect.objectContaining({ type: 'careNote', title: 'Metformin' }));
  });

  // An empty selection (skipped, or continued without choosing anything)
  // must never produce an empty gateway -- initial setup still offers
  // everything, exactly like today.
  it('falls back to the complete category set during initial setup when nothing was chosen', async () => {
    const screen = await render(<FirstThingScreen {...props} interests={[]} />);
    const categoryLabels = screen.getAllByRole('button')
      .map((item) => item.props.accessibilityLabel as string | undefined)
      .filter((label): label is string => Boolean(label?.startsWith('Add ')));
    expect(categoryLabels).toHaveLength(8);
  });

  it('retains a draft after Done dismisses the sheet while the screen remains mounted', async () => {
    const screen = await render(<FirstThingScreen {...props} />);
    await fireEvent.press(screen.getByLabelText('Add Something to do'));
    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Order prescription');
    await fireEvent.press(screen.getByText('Done'));
    await waitFor(() => expect(screen.queryByText('What needs doing?')).toBeNull());
    await fireEvent.press(screen.getByLabelText('Add Something to do'));
    expect(screen.getByDisplayValue('Order prescription')).toBeTruthy();
  });

  // Corrective task (view/edit separation): tapping an EXISTING record in
  // the category list now opens its read-only detail first, never the
  // editor directly -- Edit (from inside the detail) is what reaches it.
  it('opens a category list, then a read-only detail, before the editor', async () => {
    const appointment: LilicaRecord = {
      id: 'appointment-1',
      type: 'appointment',
      title: 'Orthodontist',
      supportedPersonId: 'person-margaret',
      status: 'scheduled',
      eventDate: '2026-09-15',
      eventTime: '10:00',
      createdAt: '2026-09-09T12:00:00.000Z',
    };
    const screen = await render(<FirstThingScreen {...props} records={[appointment]} />);

    await fireEvent.press(screen.getByLabelText('Open Appointment'));
    await fireEvent.press(screen.getByLabelText('Open Orthodontist'));
    // Read-only detail: the title is shown, but no editable field/Save.
    screen.getByText('Orthodontist');
    expect(screen.queryByLabelText('Save changes')).toBeNull();
    expect(screen.queryByDisplayValue('Orthodontist')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Edit Orthodontist'));
    screen.getByLabelText('Save changes');

    await fireEvent.press(screen.getByLabelText('Back to Appointments'));
    await fireEvent.press(screen.getByLabelText('Add appointment'));
    screen.getByLabelText('Add appointment');
    expect(screen.queryByLabelText('Save changes')).toBeNull();
  });

  it('keeps the top-level category gateway calm even when four records exist', async () => {
    const appointments: LilicaRecord[] = ['Orthodontist', 'GP', 'Dentist', 'Eye clinic'].map((title, index) => ({
      id: `appointment-${index}`,
      type: 'appointment',
      title,
      eventDate: `2026-09-${15 + index}`,
      createdAt: '2026-09-09T12:00:00.000Z',
    }));
    const screen = await render(<FirstThingScreen {...props} records={appointments} />);

    screen.getByText('GP, hospital, dentist, therapy or another visit');
    expect(screen.queryByText('4 added')).toBeNull();
    expect(screen.queryByText('Add another')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Open Appointment'));
    appointments.forEach((appointment) => screen.getByLabelText(`Open ${appointment.title}`));
    screen.getByLabelText('Add appointment');
  });

  it('confirms removal and deletes only the selected record ID', async () => {
    const appointment: LilicaRecord = {
      id: 'appointment-remove',
      type: 'appointment',
      title: 'Orthodontist',
      eventDate: '2026-09-15',
      createdAt: '2026-09-09T12:00:00.000Z',
    };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    const screen = await render(<FirstThingScreen {...props} records={[appointment]} />);

    await fireEvent.press(screen.getByLabelText('Open Appointment'));
    await fireEvent.press(screen.getByLabelText('Open Orthodontist'));
    await fireEvent.press(screen.getByLabelText('Edit Orthodontist'));
    await fireEvent.press(screen.getByLabelText('Remove appointment'));
    const buttons = alert.mock.calls[0][2];
    await act(async () => buttons?.find((button) => button.text === 'Remove')?.onPress?.());
    expect(props.onRemoveRecord).toHaveBeenCalledWith('appointment-remove');
    alert.mockRestore();
  });

  it('offers both document picker and camera entry points', async () => {
    const screen = await render(<FirstThingScreen {...props} />);
    await fireEvent.press(screen.getByLabelText('Add Important document'));
    screen.getByLabelText('Upload file');
    screen.getByLabelText('Scan with camera');
  });

  it('dismisses the sheet from its backdrop', async () => {
    const screen = await render(<FirstThingScreen {...props} />);
    await fireEvent.press(screen.getByLabelText('Add Appointment'));
    await fireEvent.press(screen.getByLabelText('Close editor', { includeHiddenElements: true }));
    await waitFor(() => expect(screen.queryByText("What's it for?")).toBeNull());
  });
});

describe('real-record-only Home characterization', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('shows the empty action and no fabricated record when no record exists', async () => {
    const screen = await render(
      <HomeScreen state={{ ...initialOnboardingState, stage: 'home', supportedPersonName: 'Margaret' }} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    screen.getByText('Start with one thing you want to keep track of.');
    expect(screen.queryByText('Today')).toBeNull();
    expect(screen.queryByText('Upcoming')).toBeNull();
    expect(screen.queryByText('Recently added')).toBeNull();
  });

  // Corrective task 1 (presentation only, 11 September 2026): the section
  // heading that used to read "Needs attention" is now "Today", and an
  // appointment happening today already belonged in a "Today" heading of
  // its own -- so both now share the one heading. No classification
  // changed: a passed (overdue) appointment and a today appointment are
  // still two distinct records with distinct deriveRecordState() results;
  // they simply render under the same section title now.
  it('places a passed appointment and a today appointment together under one "Today" heading', async () => {
    const records: LilicaRecord[] = [
      { id: 'today', type: 'appointment', title: 'Today visit', status: 'scheduled', eventDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z' },
      { id: 'past', type: 'appointment', title: 'Past visit', status: 'scheduled', eventDate: '2026-09-08', createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <HomeScreen state={{ ...initialOnboardingState, stage: 'home', records, allSetDismissed: true }} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    // Exactly one "Today" heading, not two -- both records fall under it.
    expect(screen.getAllByText('Today').length).toBe(1);
    screen.getByText('Past visit');
    screen.getByText('Today visit');
    // The passed appointment still gets its own small "Overdue" pill --
    // the per-item status indicator is unaffected by the heading rename.
    // (The at-a-glance strip also reads "Overdue", hence getAllByText.)
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
  });

  it('places a bill or task due today under the same "Today" heading as an appointment', async () => {
    const records: LilicaRecord[] = [
      { id: 'bill-today', type: 'bill', title: 'Electric bill', status: 'unresolved', dueDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <HomeScreen state={{ ...initialOnboardingState, stage: 'home', records, allSetDismissed: true }} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    screen.getByText('Today');
    screen.getByText('Electric bill');
  });

  it('summarises real state in the at-a-glance strip: overdue, due today, coming up, updates -- not category counts', async () => {
    const records: LilicaRecord[] = [
      { id: 'past', type: 'appointment', title: 'Past visit', status: 'scheduled', eventDate: '2026-09-08', createdAt: '2026-09-01T00:00:00.000Z' },
      { id: 'today', type: 'bill', title: 'Electric bill', status: 'unresolved', dueDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z' },
      { id: 'future', type: 'task', title: 'Book haircut', status: 'unresolved', dueDate: '2026-09-20', createdAt: '2026-09-01T00:00:00.000Z' },
      { id: 'recent', type: 'update', title: 'Called the GP', status: 'saved', createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
    ];
    const screen = await render(
      <HomeScreen state={{ ...initialOnboardingState, stage: 'home', records, allSetDismissed: true }} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    // "Overdue" also labels the per-item pill on the passed appointment
    // below, so assert the strip's own copy via getAllByText. The
    // "Coming up" section heading was renamed to "Upcoming" (corrective
    // task 1); this strip chip is a separate at-a-glance element and
    // still reads "Coming up".
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Coming up').length).toBeGreaterThan(0);
    screen.getByText('Due today');
    screen.getByText('Updates this week');
  });

  it('shows Assigned to you only when a real active membership exists, never as a fake zero', async () => {
    const records: LilicaRecord[] = [
      { id: 'a1', type: 'appointment', title: 'Dentist', status: 'scheduled', createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    const withoutMembership = await render(
      <HomeScreen state={{ ...initialOnboardingState, stage: 'home', records, allSetDismissed: true }} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    expect(withoutMembership.queryByText('Assigned to you')).toBeNull();

    const withMembership = await render(
      <HomeScreen
        state={{
          ...initialOnboardingState,
          stage: 'home',
          records: [{ ...records[0], assignedMembershipId: 'membership-1' }],
          allSetDismissed: true,
          activeCareSpaceId: 'space-1',
          careSpaces: { 'space-1': { membershipId: 'membership-1' } as any },
        }}
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
      />,
    );
    withMembership.getByText('Assigned to you');
  });

  it('prefers records[] over the legacy firstItem fallback', async () => {
    const current: LilicaRecord = { id: 'current', type: 'task', title: 'Current record', status: 'unresolved', createdAt: '2026-09-01T00:00:00.000Z' };
    const legacy: LilicaRecord = { id: 'legacy', type: 'task', title: 'Legacy fallback', status: 'unresolved', createdAt: '2026-09-01T00:00:00.000Z' };
    const screen = await render(
      <HomeScreen state={{ ...initialOnboardingState, stage: 'home', records: [current], firstItem: legacy }} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    screen.getByText('Current record');
    expect(screen.queryByText('Legacy fallback')).toBeNull();
  });
});
