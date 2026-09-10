import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { TextField } from '../components/TextField';
import { colors, radius, spacing } from '../theme';

type Result = { ok: true } | { ok: false; message: string };

export function RecoveryRequestScreen({ onBack, onRequest, onRequested }: {
  onBack: () => void;
  onRequest: (email: string) => Promise<Result>;
  onRequested: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const trimmed = email.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(undefined);
    const result = await onRequest(trimmed);
    setSubmitting(false);
    if (result.ok) onRequested(trimmed);
    else setError(result.message);
  }

  return (
    <Screen footer={<Button label={submitting ? 'Sending...' : 'Send recovery email'} disabled={!valid || submitting} onPress={() => void submit()} />}>
      <Header onBack={onBack} />
      <View style={styles.content}>
        <AppText variant="title" centre>Reset your password</AppText>
        <AppText variant="body" tone="soft" centre style={styles.copy}>We will send a secure 6-digit code to your email.</AppText>
        <View style={styles.form}>
          <TextField label="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" />
          {error ? <AppText variant="secondary" tone="danger" accessibilityRole="alert">{error}</AppText> : null}
        </View>
      </View>
    </Screen>
  );
}

export function RecoveryEmailSentScreen({ email, onEnterCode }: {
  email: string;
  onEnterCode: () => void;
}) {
  return (
    <Screen scroll={false}>
      <View testID="recovery-email-sent" style={styles.sentContent}>
        <View style={styles.envelope}>
          <View style={[styles.envelopeFold, styles.envelopeFoldLeft]} />
          <View style={[styles.envelopeFold, styles.envelopeFoldRight]} />
        </View>
        <AppText variant="display" centre>Check your email</AppText>
        <AppText variant="body" tone="soft" centre style={styles.sentCopy}>
          If an account exists for {email}, we have sent a code to reset your password.
        </AppText>
        <Button label="Enter code" onPress={onEnterCode} style={styles.sentButton} />
      </View>
    </Screen>
  );
}

export function RecoveryPasswordScreen({ linkError, onUpdate }: { linkError?: string; onUpdate: (password: string) => Promise<Result> }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const valid = password.length >= 8 && password === confirm;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(undefined);
    const result = await onUpdate(password);
    setSubmitting(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <Screen footer={<Button label={submitting ? 'Saving...' : 'Save new password'} disabled={!valid || submitting} onPress={() => void submit()} />}>
      <View style={styles.content}>
        <AppText variant="display" tone="primary">Choose a new password</AppText>
        <AppText variant="body" tone="soft" style={styles.passwordCopy}>Use at least 8 characters and enter it twice.</AppText>
        <View style={styles.form}>
          <TextField label="New password" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" />
          <TextField label="Confirm password" secureTextEntry autoComplete="new-password" value={confirm} onChangeText={setConfirm} placeholder="Type it again" />
          {confirm.length > 0 && password !== confirm ? <AppText variant="secondary" tone="danger">Passwords do not match.</AppText> : null}
          {linkError || error ? <AppText variant="secondary" tone="danger" accessibilityRole="alert">{linkError ?? error}</AppText> : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'flex-start', paddingTop: spacing.xl, paddingBottom: spacing.xl },
  copy: { maxWidth: 340, alignSelf: 'center', marginTop: spacing.sm },
  form: { marginTop: spacing.xl, gap: spacing.md },
  sentContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: spacing.xxxl,
  },
  envelope: {
    width: 54,
    height: 44,
    borderWidth: 3,
    borderColor: colors.teal,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  envelopeFold: {
    position: 'absolute',
    top: 9,
    width: 35,
    height: 3,
    backgroundColor: colors.teal,
  },
  envelopeFoldLeft: {
    left: -2,
    transform: [{ rotate: '38deg' }],
  },
  envelopeFoldRight: {
    right: -2,
    transform: [{ rotate: '-38deg' }],
  },
  sentCopy: {
    maxWidth: 360,
    marginTop: spacing.md,
  },
  sentButton: {
    marginTop: spacing.xl,
  },
  passwordCopy: {
    marginTop: spacing.sm,
  },
});
