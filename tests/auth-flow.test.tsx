import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { friendlyAuthError } from '../src/auth/errors';
import { AboutYouScreen } from '../src/screens/AboutYouScreen';
import { AccountScreen } from '../src/screens/AccountScreen';
import { EmailAuthScreen } from '../src/screens/EmailAuthScreen';
import { RecoveryEmailSentScreen, RecoveryPasswordScreen, RecoveryRequestScreen } from '../src/screens/RecoveryScreen';
import { RecoveryCodeScreen, VerificationScreen } from '../src/screens/VerificationScreen';

describe('Phase 5 account screens', () => {
  it('moves a verified sign-in forward and presents friendly credential failures', async () => {
    const onAuthenticated = jest.fn();
    const onSubmit = jest.fn()
      .mockResolvedValueOnce({ ok: false, message: 'That email and password do not match. Please try again.' })
      .mockResolvedValueOnce({ ok: true });
    const screen = await render(
      <EmailAuthScreen mode="login" onBack={jest.fn()} onSubmit={onSubmit} onVerificationRequired={jest.fn()} onAuthenticated={onAuthenticated} onForgotPassword={jest.fn()} />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'david@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), 'password123');
    await fireEvent.press(screen.getByLabelText('Log in'));
    await screen.findByText('That email and password do not match. Please try again.');
    await fireEvent.press(screen.getByLabelText('Log in'));
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
  });

  it('supports verification resend without treating signup as verification', async () => {
    const onResend = jest.fn().mockResolvedValue({ ok: true });
    const onVerify = jest.fn().mockResolvedValue({ ok: true });
    const screen = await render(<VerificationScreen email="david@example.com" resendDelaySeconds={0} onBack={jest.fn()} onResend={onResend} onVerify={onVerify} />);
    screen.getByText(/6-digit code to david@example.com/);
    expect(screen.getByLabelText('Continue').props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('verification-code-input'), '123456');
    await fireEvent.press(screen.getByLabelText('Continue'));
    await waitFor(() => expect(onVerify).toHaveBeenCalledWith('123456'));
    await fireEvent.press(screen.getByLabelText('Resend code'));
    await screen.findByText('A new code is on its way.');
  });

  it('requires and saves a distinct organiser display name', async () => {
    const onSave = jest.fn().mockResolvedValue({ ok: true });
    const screen = await render(<AboutYouScreen onSave={onSave} />);
    expect(screen.getByLabelText('Continue').props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByDisplayValue(''), '  David  ');
    await fireEvent.press(screen.getByLabelText('Continue'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('David'));
    screen.getByText(/separate from the person you support/);
  });

  it('supports recovery request and matching replacement passwords', async () => {
    const request = jest.fn().mockResolvedValue({ ok: true });
    const onRequested = jest.fn();
    const requestScreen = await render(<RecoveryRequestScreen onBack={jest.fn()} onRequest={request} onRequested={onRequested} />);
    await fireEvent.changeText(requestScreen.getByPlaceholderText('you@example.com'), 'david@example.com');
    await fireEvent.press(requestScreen.getByLabelText('Send recovery email'));
    await waitFor(() => expect(onRequested).toHaveBeenCalledWith('david@example.com'));

    const onEnterCode = jest.fn();
    const sentScreen = await render(<RecoveryEmailSentScreen email="david@example.com" onEnterCode={onEnterCode} />);
    sentScreen.getByText('Check your email');
    sentScreen.getByText(/sent a code to reset your password/);
    await fireEvent.press(sentScreen.getByLabelText('Enter code'));
    expect(onEnterCode).toHaveBeenCalledTimes(1);

    const verify = jest.fn().mockResolvedValue({ ok: true });
    const codeScreen = await render(<RecoveryCodeScreen email="david@example.com" onBack={jest.fn()} onResend={request} onVerify={verify} />);
    await fireEvent.changeText(codeScreen.getByTestId('verification-code-input'), '654321');
    await fireEvent.press(codeScreen.getByLabelText('Continue'));
    await waitFor(() => expect(verify).toHaveBeenCalledWith('654321'));

    const update = jest.fn().mockResolvedValue({ ok: true });
    const passwordScreen = await render(<RecoveryPasswordScreen onUpdate={update} />);
    await fireEvent.changeText(passwordScreen.getByPlaceholderText('At least 8 characters'), 'newpassword');
    await fireEvent.changeText(passwordScreen.getByPlaceholderText('Type it again'), 'different');
    expect(passwordScreen.getByLabelText('Save new password').props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(passwordScreen.getByPlaceholderText('Type it again'), 'newpassword');
    await fireEvent.press(passwordScreen.getByLabelText('Save new password'));
    await waitFor(() => expect(update).toHaveBeenCalledWith('newpassword'));
  });

  it('provides a usable sign-out route from the organiser profile', async () => {
    const onSignOut = jest.fn();
    const screen = await render(
      <AccountScreen
        displayName="David"
        email="david@example.com"
        signingOut={false}
        remindersEnabled={false}
        reminderPermissionState="undetermined"
        quietHoursEnabled={false}
        quietHoursLabel="9pm–8am"
        onToggleReminders={jest.fn()}
        onToggleQuietHours={jest.fn()}
        onSaveDisplayName={jest.fn()}
        onSignOut={onSignOut}
      />,
    );
    screen.getByText('David');
    await fireEvent.press(screen.getByLabelText('Sign out'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('friendly authentication errors', () => {
  it('does not expose raw backend credential or network errors', () => {
    expect(friendlyAuthError(new Error('Invalid login credentials'), 'signIn')).toBe('That email and password do not match. Please try again.');
    expect(friendlyAuthError(new Error('TypeError: Network request failed'), 'signUp')).toBe('Lilica could not connect just now. Check your connection and try again.');
    expect(friendlyAuthError(new Error('User already registered'), 'signUp')).toBe('An account already uses this email. Try logging in instead.');
  });
});
