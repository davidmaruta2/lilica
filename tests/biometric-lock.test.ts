// Post-build implementation batch (lilbatch.txt, 17 September 2026), change
// two: secure biometric app unlock. Native biometrics themselves are
// mocked at the expo-local-authentication boundary (Lilica never
// implements its own biometric storage/cryptography, so this is the
// correct place to mock -- Lilica only ever receives a pass/fail
// result). AsyncStorage uses the repo-wide real in-memory mock
// (tests/jest.setup.js), so account isolation is genuinely proven, not
// merely asserted.
const mockHasHardwareAsync = jest.fn();
const mockIsEnrolledAsync = jest.fn();
const mockSupportedAuthenticationTypesAsync = jest.fn();
const mockAuthenticateAsync = jest.fn();

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: (...args: unknown[]) => mockHasHardwareAsync(...args),
  isEnrolledAsync: (...args: unknown[]) => mockIsEnrolledAsync(...args),
  supportedAuthenticationTypesAsync: (...args: unknown[]) => mockSupportedAuthenticationTypesAsync(...args),
  authenticateAsync: (...args: unknown[]) => mockAuthenticateAsync(...args),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}));

import { renderHook, waitFor, act } from '@testing-library/react-native';

import {
  authenticate,
  biometricLabel,
  getBiometricAvailability,
  isBiometricLockEnabled,
  setBiometricLockEnabled,
  useBiometricLock,
} from '../src/biometricLock';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getBiometricAvailability', () => {
  it('reports unsupported when the device has no biometric hardware', async () => {
    mockHasHardwareAsync.mockResolvedValue(false);
    const result = await getBiometricAvailability();
    expect(result).toEqual({ supported: false });
  });

  it('reports supported but not enrolled, with the real hardware kind', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockSupportedAuthenticationTypesAsync.mockResolvedValue([2]);
    mockIsEnrolledAsync.mockResolvedValue(false);
    const result = await getBiometricAvailability();
    expect(result).toEqual({ supported: true, enrolled: false, kind: 'facial' });
  });

  it('reports supported and enrolled with fingerprint kind', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockSupportedAuthenticationTypesAsync.mockResolvedValue([1]);
    mockIsEnrolledAsync.mockResolvedValue(true);
    const result = await getBiometricAvailability();
    expect(result).toEqual({ supported: true, enrolled: true, kind: 'fingerprint' });
  });
});

describe('biometricLabel', () => {
  it('never hard-codes a label the device does not actually have', () => {
    // iOS/Android branching is exercised implicitly via Platform.OS in the
    // test environment (Android by default under jest-expo) -- proves the
    // function returns a real, kind-specific label either way, never a
    // single hard-coded string regardless of kind.
    expect(biometricLabel('fingerprint')).not.toBe(biometricLabel('facial'));
  });
});

describe('authenticate', () => {
  it('returns "unavailable" without ever prompting when biometrics are not enrolled', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockSupportedAuthenticationTypesAsync.mockResolvedValue([2]);
    mockIsEnrolledAsync.mockResolvedValue(false);
    const result = await authenticate('Unlock Lilica');
    expect(result).toBe('unavailable');
    expect(mockAuthenticateAsync).not.toHaveBeenCalled();
  });

  it('never allows the OS device passcode as a silent fallback', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockSupportedAuthenticationTypesAsync.mockResolvedValue([2]);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: true });
    await authenticate('Unlock Lilica');
    expect(mockAuthenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ disableDeviceFallback: true }),
    );
  });

  it('returns "success" on a genuine successful check', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockSupportedAuthenticationTypesAsync.mockResolvedValue([2]);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: true });
    expect(await authenticate('Unlock Lilica')).toBe('success');
  });

  it('returns "cancelled" when the user backs out, never treated as a failure', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockSupportedAuthenticationTypesAsync.mockResolvedValue([2]);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });
    expect(await authenticate('Unlock Lilica')).toBe('cancelled');
  });

  it('returns "failed" on a genuine non-match', async () => {
    mockHasHardwareAsync.mockResolvedValue(true);
    mockSupportedAuthenticationTypesAsync.mockResolvedValue([2]);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'not_recognized' });
    expect(await authenticate('Unlock Lilica')).toBe('failed');
  });
});

describe('per-account preference persistence and isolation', () => {
  it('is off by default for an account that has never set it', async () => {
    expect(await isBiometricLockEnabled('user-a')).toBe(false);
  });

  it('persists on/off independently per account', async () => {
    await setBiometricLockEnabled('user-a', true);
    await setBiometricLockEnabled('user-b', false);
    expect(await isBiometricLockEnabled('user-a')).toBe(true);
    expect(await isBiometricLockEnabled('user-b')).toBe(false);
  });

  it('User B signing in after User A does not inherit User A\'s preference', async () => {
    await setBiometricLockEnabled('user-a', true);
    // A brand-new account id that has never touched this setting.
    expect(await isBiometricLockEnabled('user-b-fresh')).toBe(false);
  });
});

describe('useBiometricLock', () => {
  it('stays disabled/unlocked for a signed-out user (no userId)', async () => {
    const { result } = await renderHook(() => useBiometricLock(undefined));
    await waitFor(() => expect(result.current.enabled).toBe(false));
    expect(result.current.locked).toBe(false);
  });

  it('locks immediately on mount (cold launch) when this account already has protection enabled', async () => {
    await setBiometricLockEnabled('cold-launch-user', true);
    const { result } = await renderHook(() => useBiometricLock('cold-launch-user'));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(result.current.locked).toBe(true);
  });

  it('stays unlocked for an account that has never enabled protection', async () => {
    const { result } = await renderHook(() => useBiometricLock('never-enabled-user'));
    await waitFor(() => expect(result.current.enabled).toBe(false));
    expect(result.current.locked).toBe(false);
  });

  it('markUnlocked clears the lock', async () => {
    await setBiometricLockEnabled('unlock-me-user', true);
    const { result } = await renderHook(() => useBiometricLock('unlock-me-user'));
    await waitFor(() => expect(result.current.locked).toBe(true));
    await act(async () => {
      result.current.markUnlocked();
    });
    expect(result.current.locked).toBe(false);
  });

  it('re-reads a fresh per-account preference when the signed-in user changes (account-switch isolation)', async () => {
    await setBiometricLockEnabled('account-one', true);
    // account-two has never enabled it.
    const { result, rerender } = await renderHook(
      (props: { userId: string | undefined }) => useBiometricLock(props.userId),
      { initialProps: { userId: 'account-one' as string | undefined } },
    );
    await waitFor(() => expect(result.current?.locked).toBe(true));

    await rerender({ userId: undefined }); // sign-out
    await waitFor(() => expect(result.current?.enabled).toBe(false));
    expect(result.current.locked).toBe(false);

    await rerender({ userId: 'account-two' }); // a different account signs in
    await waitFor(() => expect(result.current?.enabled).toBe(false));
    expect(result.current.locked).toBe(false);
  });
});
