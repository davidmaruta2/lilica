import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { TextField } from '../components/TextField';
import { colors, radius, spacing } from '../theme';

type Props = {
  email?: string;
  onBack: () => void;
  onContinue: (email: string) => void;
};

export function EmailAuthScreen({ email = '', onBack, onContinue }: Props) {
  const [value, setValue] = useState(email);
  const trimmed = value.trim();
  const canContinue = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  return (
    <Screen footer={<Button label="Continue" disabled={!canContinue} onPress={() => onContinue(trimmed)} />}>
      <Header onBack={onBack} />
      <View style={styles.focus}>
        <View style={styles.mark}>
          <View style={styles.envelope}>
            <View style={styles.envelopeFold} />
          </View>
        </View>
        <AppText variant="title" centre>What's your email?</AppText>
      </View>
      <View style={styles.form}>
        <TextField
          label="Email"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          value={value}
          onChangeText={setValue}
          returnKeyType="done"
          onSubmitEditing={canContinue ? () => onContinue(trimmed) : undefined}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  focus: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  mark: {
    width: 138,
    height: 138,
    borderRadius: radius.pill,
    backgroundColor: colors.oliveSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  envelope: {
    width: 68,
    height: 48,
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  envelopeFold: {
    width: 48,
    height: 48,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: colors.primary,
    transform: [{ rotate: '-45deg' }],
    alignSelf: 'center',
    marginTop: -29,
  },
  form: {
    marginTop: spacing.xxl,
  },
});
