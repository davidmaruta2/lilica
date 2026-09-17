// Post-build implementation batch (lilbatch.txt, 17 September 2026):
// secure native biometric app unlock, layered on top of the EXISTING
// Supabase authentication/session (src/auth/AuthProvider.tsx) -- never a
// second Lilica identity, never a replacement for a valid account. This
// module owns exactly two things: reading the device's own biometric
// capability/result (via expo-local-authentication -- Lilica never
// implements its own biometric storage or cryptography, and never stores
// a biometric template or scan of any kind, only the native pass/fail
// result), and persisting one small per-account boolean preference.
import { useEffect, useRef, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Account-scoped, exactly like src/storage.ts's own onboarding-state key
// (`AsyncStorage` keyed by the authenticated Supabase user id) -- this is
// the SAME established isolation convention, not a new one. A biometric
// preference set by one Lilica account on this device must never apply
// to, or be inherited by, a different account signing in afterwards.
const KEY_PREFIX = 'lilica_biometric_lock_enabled_';

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export type BiometricKind = 'facial' | 'fingerprint' | 'iris' | 'generic';

export type BiometricAvailability =
  | { supported: true; enrolled: true; kind: BiometricKind }
  | { supported: true; enrolled: false; kind: BiometricKind }
  | { supported: false };

// Reads the device's REAL current capability every time it's called --
// never cached -- because a device's own enrolled biometrics can change
// (added, removed, or the hardware becomes temporarily unavailable) at
// any point while Lilica is installed (brief section 7/9).
export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return { supported: false };
  // supportedAuthenticationTypesAsync() reports the HARDWARE's own
  // capability regardless of enrollment, so "not enrolled yet" can still
  // say the right thing ("Set up Face ID…") rather than a generic term.
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const kind: BiometricKind = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
    ? 'facial'
    : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      ? 'fingerprint'
      : types.includes(LocalAuthentication.AuthenticationType.IRIS)
        ? 'iris'
        : 'generic';
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return { supported: true, enrolled, kind };
}

// Never hard-codes "Face ID" on a device that doesn't have it (brief
// section 5) -- iOS distinguishes Face ID/Touch ID by kind; Android has
// no equivalent per-kind marketing name, so a calm generic term is used
// there instead, matching this app's existing plain-language copy style.
export function biometricLabel(kind: BiometricKind): string {
  if (Platform.OS === 'ios') return kind === 'facial' ? 'Face ID' : 'Touch ID';
  if (kind === 'facial') return 'Face unlock';
  if (kind === 'fingerprint') return 'Fingerprint unlock';
  return 'Biometric unlock';
}

export async function isBiometricLockEnabled(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(storageKey(userId));
  return value === 'true';
}

export async function setBiometricLockEnabled(userId: string, enabled: boolean): Promise<void> {
  if (enabled) await AsyncStorage.setItem(storageKey(userId), 'true');
  else await AsyncStorage.removeItem(storageKey(userId));
}

// A brief real background trip (a share sheet, a permission dialog, a
// quick app-switcher glance) must never re-trigger the prompt -- brief
// section 7's "no excessive repeated prompts during normal navigation".
// Only a genuine return from the background after this long re-locks.
const BACKGROUND_GRACE_MS = 5_000;

export type BiometricLockState = {
  // Whether THIS account (the userId passed in) has biometric protection
  // turned on at all -- undefined until the very first per-account read
  // resolves, so callers can avoid flashing an unlocked frame before it's
  // known. Always false for a signed-out user (userId undefined).
  enabled: boolean | undefined;
  // Whether the lock screen should currently cover the app. Only ever
  // true while `enabled` is also true.
  locked: boolean;
  // Called once the account has confirmed the toggle (see AccountScreen's
  // own biometric row) -- keeps this hook's own state in sync without a
  // second read from storage.
  setEnabled: (next: boolean) => void;
  // Called on a successful unlock -- clears `locked` and starts a fresh
  // grace window so returning from a brief background trip immediately
  // afterwards doesn't instantly re-lock.
  markUnlocked: () => void;
};

// Post-build implementation batch (lilbatch.txt, 17 September 2026): the
// one hook App.tsx uses to decide whether to render BiometricLockScreen
// instead of the app's real content. `userId` is the authenticated
// Supabase session's own user id (auth.session?.user.id) -- undefined
// while signed out. Re-reads the per-account preference fresh every time
// userId changes, which is exactly what keeps two different Lilica
// accounts on the same device correctly isolated (brief section 9): User
// B signing in after User A signs out gets User B's own stored
// preference (default off), never User A's.
export function useBiometricLock(userId: string | undefined): BiometricLockState {
  const [enabled, setEnabledState] = useState<boolean | undefined>(undefined);
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setEnabledState(false);
      setLocked(false);
      return;
    }
    setEnabledState(undefined);
    isBiometricLockEnabled(userId).then((isEnabled) => {
      if (!active) return;
      setEnabledState(isEnabled);
      // Cold launch / fresh sign-in: lock immediately if this account has
      // protection on -- never render real content first and lock a beat
      // later.
      setLocked(isEnabled);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !enabled) return;
    function handleChange(next: AppStateStatus) {
      if (next === 'active') {
        if (backgroundedAt.current !== null && Date.now() - backgroundedAt.current > BACKGROUND_GRACE_MS) {
          setLocked(true);
        }
        backgroundedAt.current = null;
      } else {
        backgroundedAt.current = Date.now();
      }
    }
    const subscription = AppState.addEventListener('change', handleChange);
    return () => subscription.remove();
  }, [userId, enabled]);

  return {
    enabled,
    locked,
    setEnabled: setEnabledState,
    markUnlocked: () => {
      backgroundedAt.current = null;
      setLocked(false);
    },
  };
}

export type UnlockResult = 'success' | 'cancelled' | 'failed' | 'unavailable';

// The ONE place LocalAuthentication.authenticateAsync() is ever called.
// `disableDeviceFallback: true` deliberately keeps this an actual
// biometric check rather than silently accepting the device's own
// passcode -- Lilica's own fallback when biometrics fail is signing out
// back to the existing Lilica login (brief section 8), never a second,
// device-passcode-shaped security model of its own.
export async function authenticate(promptMessage: string): Promise<UnlockResult> {
  const availability = await getBiometricAvailability();
  if (!availability.supported || !availability.enrolled) return 'unavailable';
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: true,
    });
    if (result.success) return 'success';
    if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel') {
      return 'cancelled';
    }
    return 'failed';
  } catch {
    return 'failed';
  }
}
