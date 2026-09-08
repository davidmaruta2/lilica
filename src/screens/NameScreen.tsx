import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { TextField } from '../components/TextField';
import { spacing } from '../theme';

type Props = {
  name?: string;
  onBack: () => void;
  onChangeName: (name: string) => void;
  onContinue: () => void;
};

export function NameScreen({ name = '', onBack, onChangeName, onContinue }: Props) {
  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button label="Continue" disabled={name.trim().length < 1} onPress={onContinue} />
        </View>
      }
    >
      <Header onBack={onBack} />
      <View style={styles.prompt}>
        <AppText variant="title" centre>What's their name?</AppText>
        <AppText variant="body" tone="soft" centre style={styles.supporting}>
          What do you call them?
        </AppText>
      </View>
      <View style={styles.form}>
        <TextField
          label="First or preferred name"
          autoCapitalize="words"
          placeholder="Margaret"
          value={name}
          onChangeText={onChangeName}
          returnKeyType="done"
          onSubmitEditing={name.trim() ? onContinue : undefined}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  supporting: {
    marginTop: spacing.sm,
    maxWidth: 300,
  },
  prompt: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  form: {
    marginTop: spacing.xxl,
  },
  footer: {
    gap: spacing.sm,
  },
});
