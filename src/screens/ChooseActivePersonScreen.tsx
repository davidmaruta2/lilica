import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { OptionRow } from '../components/OptionRow';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { spacing } from '../theme';
import { LocalCareSpaceState } from '../types';

export function ChooseActivePersonScreen({ people, selectedId, onBack, onSelect, onContinue, onLater }: {
  people: LocalCareSpaceState[];
  selectedId?: string;
  onBack: () => void;
  onSelect: (careSpaceId: string) => void;
  onContinue: () => void;
  onLater?: () => void;
}) {
  return (
    <Screen footer={(
      <View style={styles.footer}>
        <Button label={onLater ? 'Set up now' : 'Continue'} disabled={!selectedId} onPress={onContinue} />
        {onLater ? <Button label="Set up later" variant="text" onPress={onLater} /> : null}
      </View>
    )}>
      <Header onBack={onBack} />
      <View style={styles.heading}>
        <AppText variant="title" centre>Who would you like to set up first?</AppText>
        <AppText variant="body" tone="soft" centre>We'll start with one person. You can finish setting up the others afterwards.</AppText>
      </View>
      <View style={styles.list}>
        {people.map((person) => (
          <OptionRow
            key={person.careSpaceId}
            title={person.displayName}
            description={person.relationshipLabel || person.relationshipType}
            selected={selectedId === person.careSpaceId}
            onPress={() => onSelect(person.careSpaceId)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  list: { marginTop: spacing.xl, gap: spacing.sm },
  footer: { gap: spacing.xxs },
});
