import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { CodeInput } from '../components/CodeInput';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { spacing } from '../theme';

type Result = { ok: true } | { ok: false; message: string };
type Purpose = 'signup' | 'recovery';

type CodeScreenProps = {
  purpose: Purpose;
  email: string;
  linkError?: string;
  resendDelaySeconds?: number;
  onBack: () => void;
  onResend: () => Promise<Result>;
  onVerify: (code: string) => Promise<Result>;
};

function CodeScreen({ purpose, email, linkError, resendDelaySeconds = 30, onBack, onResend, onVerify }: CodeScreenProps) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(resendDelaySeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendIn((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function resend() {
    if (resendIn > 0 || sending) return;
    setSending(true);
    setError(undefined);
    setMessage(undefined);
    const result = await onResend();
    setSending(false);
    if (result.ok) {
      setMessage('A new code is on its way.');
      setResendIn(resendDelaySeconds);
    } else {
      setError(result.message);
    }
  }

  async function verify() {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    setError(undefined);
    const result = await onVerify(code);
    setVerifying(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <Screen>
      <Header onBack={onBack} />
      <View testID={`${purpose}-code-content`} style={styles.content}>
        <AppText variant="display" tone="primary">Enter your code</AppText>
        <AppText variant="body" tone="soft" style={styles.copy}>
          We sent a 6-digit code to {email} {purpose === 'recovery' ? 'to reset your password.' : 'to verify your account.'}
        </AppText>
        <AppText variant="body" tone="muted" style={styles.guidance}>
          Look out for an email from auth@luxfordinteractive.com. If it has not landed in a minute or two, check your junk or spam folder.
        </AppText>
        <View style={styles.form}>
          <CodeInput value={code} onChangeText={setCode} />
          {message ? <AppText variant="secondary" tone="success" centre>{message}</AppText> : null}
          {linkError || error ? <AppText variant="secondary" tone="danger" centre accessibilityRole="alert">{linkError ?? error}</AppText> : null}
          <Button label={verifying ? 'Checking...' : 'Continue'} disabled={code.length !== 6 || verifying} onPress={() => void verify()} />
          <Button
            label={sending ? 'Sending...' : resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            variant="text"
            disabled={sending || resendIn > 0}
            onPress={() => void resend()}
          />
        </View>
      </View>
    </Screen>
  );
}

type VerificationProps = Omit<CodeScreenProps, 'purpose'>;

export function VerificationScreen(props: VerificationProps) {
  return <CodeScreen {...props} purpose="signup" />;
}

export function RecoveryCodeScreen(props: VerificationProps) {
  return <CodeScreen {...props} purpose="recovery" />;
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  copy: {
    marginTop: spacing.md,
    maxWidth: 380,
  },
  guidance: {
    marginTop: spacing.md,
    maxWidth: 400,
  },
  form: {
    width: '100%',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
});
