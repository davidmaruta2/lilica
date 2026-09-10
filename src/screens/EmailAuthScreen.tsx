import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { TextField } from '../components/TextField';
import { colors, radius, spacing } from '../theme';

type Result = { ok: true; verificationRequired?: boolean } | { ok: false; message: string };

type Props = {
  mode: 'create' | 'login';
  initialEmail?: string;
  onBack: () => void;
  onSubmit: (email: string, password: string) => Promise<Result>;
  onVerificationRequired: (email: string) => void;
  onAuthenticated: () => void;
  onForgotPassword: () => void;
};

export function EmailAuthScreen({
  mode,
  initialEmail = '',
  onBack,
  onSubmit,
  onVerificationRequired,
  onAuthenticated,
  onForgotPassword,
}: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const passwordInput = useRef<TextInput>(null);
  const trimmedEmail = email.trim();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const validPassword = password.length >= 8;
  const canSubmit = validEmail && validPassword && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(undefined);
    const result = await onSubmit(trimmedEmail, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.verificationRequired) onVerificationRequired(trimmedEmail);
    else onAuthenticated();
  }

  return (
    <Screen footer={<Button label={submitting ? 'Please wait...' : mode === 'create' ? 'Create account' : 'Log in'} disabled={!canSubmit} onPress={() => void submit()} />}>
      <Header onBack={onBack} />
      <View testID="email-content" style={styles.content}>
        <View style={styles.focus}>
          <View style={styles.mark}>
            <AppText variant="title" tone="primary">@</AppText>
          </View>
          <AppText variant="title" centre>{mode === 'create' ? 'Create your account' : 'Welcome back'}</AppText>
          <AppText variant="body" tone="soft" centre style={styles.intro}>
            {mode === 'create' ? 'We’ll email you a code to verify your account.' : 'Log in with your Lilica email and password.'}
          </AppText>
        </View>
        <View style={styles.form}>
          <TextField
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordInput.current?.focus()}
          />
          <TextField
            ref={passwordInput}
            label="Password"
            autoCapitalize="none"
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            autoCorrect={false}
            secureTextEntry
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            onSubmitEditing={canSubmit ? () => void submit() : undefined}
          />
          {error ? <AppText variant="secondary" tone="danger" accessibilityRole="alert">{error}</AppText> : null}
          {mode === 'login' ? <Button label="Forgot password?" variant="text" onPress={onForgotPassword} /> : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'flex-start', paddingTop: spacing.lg, paddingBottom: spacing.xl },
  focus: { alignItems: 'center' },
  mark: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.oliveSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  intro: { marginTop: spacing.sm, maxWidth: 330 },
  form: { marginTop: spacing.xl, gap: spacing.md },
});
