import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { CategoryIcon, visualFor } from './HomeScreen';
import { colors, radius, spacing } from '../theme';
import { LilicaRecord } from '../types';

// People-screen final implementation (Downloads\peopleimproved.png): the
// People overview now shows at most four Key Contacts, with a "View all
// (N)" link opening this screen for the complete list -- exactly the
// "minimum dedicated view needed" the brief asks for, since no existing
// screen already lists every contact record in one place. Reuses the
// same contact row rendering, sort order and Add path PersonScreen's own
// preview already used; no new contact data system.
function contactDetail(record: LilicaRecord): string | undefined {
  return [record.role, record.phone, record.email].filter(Boolean).join(' · ') || undefined;
}

type Props = {
  contacts: LilicaRecord[];
  personName?: string;
  onBack: () => void;
  onOpenRecord: (recordId: string) => void;
  onAddContact: () => void;
};

export function ContactsListScreen({ contacts, personName, onBack, onOpenRecord, onAddContact }: Props) {
  return (
    <Screen>
      <Header
        title="Key contacts"
        onBack={onBack}
        right={(
          <Pressable accessibilityRole="button" accessibilityLabel="Add a contact" onPress={onAddContact} hitSlop={8}>
            <AppText variant="secondary" tone="primary">Add</AppText>
          </Pressable>
        )}
      />
      {contacts.length > 0 ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {contacts.map((record) => {
            const visual = visualFor(record.type);
            const detail = contactDetail(record);
            return (
              <Pressable
                key={record.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${record.title}`}
                onPress={() => onOpenRecord(record.id)}
                style={styles.row}
              >
                <View style={[styles.iconChip, { backgroundColor: visual.tint }]}>
                  <CategoryIcon type={record.type} color={visual.accent} />
                </View>
                <View style={styles.rowCopy}>
                  <AppText variant="bodyStrong" numberOfLines={1}>{record.title}</AppText>
                  {detail ? <AppText variant="secondary" tone="soft" numberOfLines={1}>{detail}</AppText> : null}
                </View>
                <View style={styles.chevron} />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <AppText variant="secondary" tone="soft">
          No key contacts saved for {personName || 'them'} yet — GP, pharmacy, a neighbour or anyone else useful to have on hand.
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: { flex: 1, gap: 2 },
  chevron: {
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.muted,
    transform: [{ rotate: '45deg' }],
  },
});
