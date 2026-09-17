import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';
import { UnlockResult } from '../biometricLock';
import { Button } from './Button';
import { AppText } from './Text';
import { Wordmark } from './Wordmark';

// Post-build implementation batch (lilbatch.txt, 17 September 2026): the
// full-screen cover shown whenever biometric protection is enabled and
// the app is currently locked (App.tsx's useBiometricLock()). Renders
// INSTEAD of the app's normal content -- see App.tsx's final return --
// so no protected care information is ever mounted behind it (brief
// section 5/7's "never expose protected content" requirement). Never a
// dead end: unlock retries and "Log out" (the existing Lilica
// authentication route) are always available.
type Props = {
  biometricLabel: string;
  // Called once on mount, and again whenever the user taps "Try again" --
  // App.tsx owns the actual authenticate() call so this component stays a
  // pure presentation layer.
  onAttemptUnlock: () => Promise<UnlockResult>;
  onUnlocked: () => void;
  onSignOut: () => void;
  signingOut: boolean;
};

export function BiometricLockScreen({ biometricLabel, onAttemptUnlock, onUnlocked, onSignOut, signingOut }: Props) {
  const [status, setStatus] = useState<'prompting' | 'failed' | 'cancelled' | 'unavailable'>('prompting');
  const [attempting, setAttempting] = useState(false);

  async function attempt() {
    setAttempting(true);
    setStatus('prompting');
    const result = await onAttemptUnlock();
    setAttempting(false);
    if (result === 'success') {
      onUnlocked();
      return;
    }
    setStatus(result === 'unavailable' ? 'unavailable' : result === 'cancelled' ? 'cancelled' : 'failed');
  }

  useEffect(() => {
    void attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.backdrop}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.frame}>
          <Wordmark tone="light" />
          <View style={styles.copy}>
            <AppText variant="display" tone="white" centre style={styles.heading}>Lilica is locked</AppText>
            {status === 'unavailable' ? (
              <AppText variant="body" tone="white" centre style={styles.body}>
                {biometricLabel} isn't available on this device right now. Sign out and sign back in to continue.
              </AppText>
            ) : status === 'failed' ? (
              <AppText variant="body" tone="white" centre style={styles.body}>
                That didn't work. Please try again.
              </AppText>
            ) : (
              <AppText variant="body" tone="white" centre style={styles.body}>
                Use {biometricLabel} to continue.
              </AppText>
            )}
          </View>
          {status !== 'unavailable' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Unlock with ${biometricLabel}`}
              onPress={() => void attempt()}
              disabled={attempting}
              style={({ pressed }) => [styles.unlockButton, pressed && styles.unlockButtonPressed]}
            >
              <AppText variant="button" tone="primary">{attempting ? 'Checking…' : 'Try again'}</AppText>
            </Pressable>
          ) : null}
          <Button
            label={signingOut ? 'Signing out…' : 'Log out'}
            variant="textLight"
            disabled={signingOut}
            onPress={onSignOut}
            style={styles.signOut}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.stageDeep,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.xl,
  },
  copy: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  heading: {
    fontFamily: 'Fraunces_800ExtraBold',
  },
  body: {
    maxWidth: 320,
    opacity: 0.9,
  },
  unlockButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  unlockButtonPressed: {
    opacity: 0.9,
  },
  signOut: {
    marginTop: spacing.sm,
  },
});
