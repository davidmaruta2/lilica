import { StyleSheet, View } from 'react-native';

import { relationships } from '../data/options';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { OptionRow } from '../components/OptionRow';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { spacing } from '../theme';
import { Relationship } from '../types';

type Props = {
  selected?: Relationship;
  onBack: () => void;
  onSelect: (relationship: Relationship) => void;
  onContinue: () => void;
};

export function RelationshipScreen({ selected, onBack, onSelect, onContinue }: Props) {
  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button label="Continue" disabled={!selected} onPress={onContinue} />
        </View>
      }
    >
      <Header onBack={onBack} />
      <View style={styles.prompt}>
        <AppText variant="title" centre>Who are you helping?</AppText>
        <AppText variant="body" tone="soft" centre style={styles.supporting}>
          Choose the answer that feels right.
        </AppText>
      </View>
      <View style={styles.options}>
        {relationships.map((relationship) => (
          <OptionRow
            key={relationship}
            title={relationship}
            selected={selected === relationship}
            onPress={() => onSelect(relationship)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  supporting: {
    marginTop: spacing.sm,
  },
  prompt: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  options: {
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  footer: {
    gap: spacing.sm,
  },
});
