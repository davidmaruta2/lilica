import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { Wordmark } from '../components/Wordmark';
import { colors, radius, spacing } from '../theme';
import { AuthState } from '../types';

type Props = {
  onBack: () => void;
  onAuth: (auth: AuthState) => void;
  onEmail: () => void;
};

export function AuthScreen({ onBack, onAuth, onEmail }: Props) {
  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button label="Continue with Apple" onPress={() => onAuth({ method: 'apple' })} />
          <Button label="Continue with Google" variant="secondary" onPress={() => onAuth({ method: 'google' })} />
          <Button label="Continue with email" variant="secondary" onPress={onEmail} />
          <Button label="Log in" variant="text" onPress={() => onAuth({ method: 'local', returning: true })} />
        </View>
      }
    >
      <Header onBack={onBack} />
      <View style={styles.focus}>
        <View style={styles.mark}>
          <Wordmark />
        </View>
        <AppText variant="title" centre>Create your account</AppText>
        <AppText variant="body" tone="soft" centre style={styles.copy}>
          Save your place and come back anytime.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  focus: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.lg,
  },
  mark: {
    width: 170,
    height: 170,
    borderRadius: radius.pill,
    backgroundColor: colors.oliveSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  copy: {
    marginTop: spacing.sm,
  },
  footer: {
    gap: spacing.xs,
  },
});
