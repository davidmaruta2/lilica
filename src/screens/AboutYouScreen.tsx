import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { TextField } from '../components/TextField';
import { colors, radius, spacing } from '../theme';

type Result = { ok: true } | { ok: false; message: string };

export function AboutYouScreen({ initialName = '', onSave }: {
  initialName?: string;
  onSave: (displayName: string) => Promise<Result>;
}) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 100 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(undefined);
    const result = await onSave(trimmed);
    setSubmitting(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <Screen footer={<Button label={submitting ? 'Saving...' : 'Continue'} disabled={!canSubmit} onPress={() => void submit()} />}>
      <View style={styles.content}>
        <View style={styles.mark}><AppText variant="title" tone="primary">You</AppText></View>
        <AppText variant="title" centre>About you</AppText>
        <AppText variant="body" tone="soft" centre style={styles.copy}>
          This is your Lilica profile, separate from the person you support.
        </AppText>
        <View style={styles.form}>
          <TextField
            label="Your name"
            autoCapitalize="words"
            autoComplete="name"
            placeholder="David"
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            onSubmitEditing={canSubmit ? () => void submit() : undefined}
          />
          {error ? <AppText variant="secondary" tone="danger" accessibilityRole="alert">{error}</AppText> : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'flex-start', paddingTop: spacing.xxxl, paddingBottom: spacing.xl },
  mark: { width: 104, height: 104, borderRadius: radius.pill, backgroundColor: colors.oliveSoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.lg },
  copy: { maxWidth: 340, alignSelf: 'center', marginTop: spacing.sm },
  form: { marginTop: spacing.xl, gap: spacing.md },
});
