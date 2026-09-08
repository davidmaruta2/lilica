import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { OptionRow } from '../components/OptionRow';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { interestOptions } from '../data/options';
import { spacing } from '../theme';
import { Interest } from '../types';

type Props = {
  selected: Interest[];
  personName?: string;
  onBack: () => void;
  onToggle: (interest: Interest) => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function InterestsScreen({ selected, personName, onBack, onToggle, onContinue, onSkip }: Props) {
  const name = personName?.trim() || 'them';

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button label="Continue" onPress={onContinue} />
          <Button label="Skip for now" variant="text" onPress={onSkip} />
        </View>
      }
    >
      <Header onBack={onBack} />
      <View style={styles.prompt}>
        <AppText variant="title" centre>What do you help {name} with?</AppText>
        <AppText variant="body" tone="soft" centre style={styles.supporting}>
          Choose what feels familiar.
        </AppText>
      </View>
      <View style={styles.options}>
        {interestOptions.map((option) => (
          <OptionRow
            key={option.id}
            title={option.title}
            description={option.description}
            selected={selected.includes(option.id)}
            multi
            onPress={() => onToggle(option.id)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  supporting: {
    marginTop: spacing.sm,
    maxWidth: 310,
  },
  prompt: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  options: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  footer: {
    gap: spacing.sm,
  },
});
