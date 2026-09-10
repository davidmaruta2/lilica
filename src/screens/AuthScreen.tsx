import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { Wordmark } from '../components/Wordmark';
import { colors, radius, spacing } from '../theme';

type Props = {
  onBack: () => void;
  onCreateAccount: () => void;
  onLogIn: () => void;
};

export function AuthScreen({ onBack, onCreateAccount, onLogIn }: Props) {
  return (
    <Screen>
      <Header onBack={onBack} />
      <View style={styles.focus}>
        <View style={styles.mark}>
          <Wordmark />
        </View>
        <AppText variant="title" centre>Create your account</AppText>
        <AppText variant="body" tone="soft" centre style={styles.intro}>
          Use your email to keep your Lilica account secure.
        </AppText>
        <View style={styles.actions}>
          <Button label="Continue with email" onPress={onCreateAccount} />
          <Button label="Log in" variant="text" onPress={onLogIn} />
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
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
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
  intro: {
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  actions: {
    width: '100%',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
});
