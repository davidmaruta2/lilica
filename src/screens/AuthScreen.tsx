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
    <Screen>
      <Header onBack={onBack} />
      <View style={styles.focus}>
        <View style={styles.mark}>
          <Wordmark />
        </View>
        <AppText variant="title" centre>Create your account</AppText>
        <View style={styles.actions}>
          <Button label="Continue with Apple" onPress={() => onAuth({ method: 'apple' })} />
          <Button label="Continue with Google" variant="secondary" onPress={() => onAuth({ method: 'google' })} />
          <Button label="Continue with email" variant="secondary" onPress={onEmail} />
          <Button label="Log in" variant="text" onPress={() => onAuth({ method: 'local', returning: true })} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  focus: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    minHeight: 540,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  mark: {
    width: 124,
    height: 124,
    borderRadius: radius.pill,
    backgroundColor: colors.oliveSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  actions: {
    width: '100%',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
});
