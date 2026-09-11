import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { CategoryIcon, visualFor } from './HomeScreen';
import { deriveRecordState, formatDateForDisplay } from '../records';
import { colors, radius, spacing } from '../theme';
import { LilicaRecord } from '../types';

// Corrective task: the Home strip's "Updates this week" tile now opens
// this screen directly, on explicit product instruction, rather than
// scrolling within Home. Scoped specifically to wellbeing-update records
// (type 'update') entered/edited in the last 7 days -- matching this
// tile's own name literally, not "anything of any type edited recently"
// (the earlier, broader in-page-scroll version). Opens the normal record
// editor via onOpenRecord, exactly like every other projection (Calendar/
// To Do/Person) already does -- no second editor.
type Props = {
  records: LilicaRecord[];
  personName?: string;
  onOpenRecord: (recordId: string) => void;
  onBack: () => void;
};

function recentFirst(a: LilicaRecord, b: LilicaRecord) {
  return (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? '');
}

export function WellbeingUpdatesScreen({ records, personName, onOpenRecord, onBack }: Props) {
  const updates = records
    .filter((record) => record.type === 'update' && deriveRecordState(record).recentlyUpdated)
    .sort(recentFirst);
  const visual = visualFor('update');

  return (
    <Screen>
      <Header title="Wellbeing updates this week" onBack={onBack} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText variant="secondary" tone="soft">
          {personName ? `Wellbeing updates entered for ${personName} in the last 7 days.` : 'Wellbeing updates entered in the last 7 days.'}
        </AppText>
        {updates.length > 0 ? (
          <View style={styles.list}>
            {updates.map((record) => (
              <Pressable
                key={record.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${record.title}`}
                onPress={() => onOpenRecord(record.id)}
                style={styles.row}
              >
                <View style={[styles.iconChip, { backgroundColor: visual.tint }]}>
                  <CategoryIcon type="update" color={visual.accent} />
                </View>
                <View style={styles.rowCopy}>
                  <AppText variant="bodyStrong" numberOfLines={2}>{record.title}</AppText>
                  {record.notes ? <AppText variant="secondary" tone="soft" numberOfLines={2}>{record.notes}</AppText> : null}
                  <AppText variant="meta" tone="muted">
                    {formatDateForDisplay(record.updatedAt?.slice(0, 10) ?? record.createdAt?.slice(0, 10))}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <AppText variant="secondary" tone="soft" style={styles.emptyState}>No wellbeing updates entered this week yet.</AppText>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
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
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  emptyState: {
    marginTop: spacing.xl,
  },
});
