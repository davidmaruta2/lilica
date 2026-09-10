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
import { Interest, LilicaRecord } from '../src/types';

describe('protected Phase 1 onboarding surfaces', () => {
  it('retains the three-page Welcome journey and its entry actions', async () => {
    const onStart = jest.fn();
    const onLogin = jest.fn();
    const screen = await render(<WelcomeScreen onStart={onStart} onLogin={onLogin} />);

    screen.getByText('Welcome to Lilica');
    screen.getByText('Stay independent');
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

  it('keeps all six interest choices, skipping, and selection callbacks', async () => {
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
      'Appointments & visits',
      'Home & bills',
      'Everyday things to sort',
      'Important paperwork',
      'Keeping family updated',
      'Care & routines',
    ].forEach((label) => screen.getByText(label));
    await fireEvent.press(screen.getByText('Appointments & visits'));
    expect(onToggle).toHaveBeenCalledWith('appointments');
    await fireEvent.press(screen.getByLabelText('Skip for now'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe('protected structured-record onboarding', () => {
  const props = {
    interests: [] as Interest[],
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
      'Home matter',
      'Important document',
      'Contact',
      'Care information',
      'Update',
    ].forEach((label) => screen.getByLabelText(`Add ${label}`));
    await fireEvent.press(screen.getByLabelText("I'll add things later"));
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it('orders interest-matched categories first without removing any category', async () => {
    const screen = await render(<FirstThingScreen {...props} interests={['paperwork']} />);
    const categoryLabels = screen.getAllByRole('button')
      .map((item) => item.props.accessibilityLabel as string | undefined)
      .filter((label): label is string => Boolean(label?.startsWith('Add ')));
    expect(categoryLabels[0]).toBe('Add Important document');
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

  it('opens a category list before selecting or adding another record', async () => {
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
    screen.getByLabelText('Edit Orthodontist');
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
    appointments.forEach((appointment) => screen.getByLabelText(`Edit ${appointment.title}`));
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
    expect(screen.queryByText('Needs attention')).toBeNull();
    expect(screen.queryByText('Today')).toBeNull();
    expect(screen.queryByText('Coming up')).toBeNull();
    expect(screen.queryByText('Latest')).toBeNull();
  });

  it('currently places due-today and passed appointments in Needs attention', async () => {
    const records: LilicaRecord[] = [
      { id: 'today', type: 'appointment', title: 'Today visit', status: 'scheduled', eventDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z' },
      { id: 'past', type: 'appointment', title: 'Past visit', status: 'scheduled', eventDate: '2026-09-08', createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <HomeScreen state={{ ...initialOnboardingState, stage: 'home', records, allSetDismissed: true }} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    screen.getByText('Needs attention');
    screen.getByText('Today visit');
    screen.getByText('Past visit');
    expect(screen.queryByText('Today')).toBeNull();
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
