import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { colors, radius, spacing } from '../theme';
import { SupportedPersonDraft } from '../types';

export function PeopleReviewScreen({ people, submitting, error, onBack, onEdit, onRemove, onAdd, onContinue }: {
  people: SupportedPersonDraft[];
  submitting?: boolean;
  error?: string;
  onBack: () => void;
  onEdit: (draftId: string) => void;
  onRemove: (draftId: string) => void;
  onAdd: () => void;
  onContinue: () => void;
}) {
  return (
    <Screen footer={<Button label={submitting ? 'Creating care spaces...' : 'Continue'} disabled={people.length === 0 || submitting} onPress={onContinue} />}>
      <Header onBack={onBack} />
      <View style={styles.heading}>
        <AppText variant="title" centre>People you're helping</AppText>
        <AppText variant="body" tone="soft" centre>Check we have everyone right.</AppText>
      </View>
      <View style={styles.list}>
        {people.map((person) => (
          <View key={person.draftId} style={styles.row}>
            <View style={styles.copy}>
              <AppText variant="bodyStrong">{person.displayName}</AppText>
              <AppText variant="secondary" tone="soft">{person.relationshipLabel || person.relationshipType}</AppText>
            </View>
            <Button label="Edit" variant="text" onPress={() => onEdit(person.draftId)} style={styles.action} />
            <Button label="Remove" variant="text" onPress={() => onRemove(person.draftId)} style={styles.action} />
          </View>
        ))}
        <Button label="+ Add another person" variant="text" onPress={onAdd} />
        {error ? <AppText variant="secondary" tone="danger" accessibilityRole="alert">{error}</AppText> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  list: { marginTop: spacing.xl, gap: spacing.sm },
  row: { minHeight: 76, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  copy: { flex: 1 },
  action: { width: 'auto', paddingHorizontal: spacing.xs },
});
