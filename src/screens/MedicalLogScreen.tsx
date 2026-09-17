import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { formatDateForDisplay } from '../records';
import { colors, spacing } from '../theme';
import { LilicaRecord, LilicaRecordType } from '../types';

// Post-build implementation batch (lilbatch.txt, 17 September 2026):
// structured Medical Log -- three deliberately separate areas (care
// needs, diagnosed conditions, prescribed medicines), never a single
// generic text box. Modelled directly on DocumentsScreen.tsx's own
// bounded-list architecture (same Screen/Header pattern, same row
// language) and reads records the exact same way PersonScreen.tsx
// already does -- filtered locally from the already-loaded, already-
// synced `records` array, no second fetch, no new cache. Reachable only
// from the Settings drawer's person-scoped group (App.tsx/
// SettingsMenu.tsx) -- deliberately NOT added to FirstThingScreen's
// protected everyday category stack (see HomeScreen.tsx's categoryLabel
// comment for why).
type Props = {
  personName?: string;
  isSelf: boolean;
  records: LilicaRecord[];
  onBack: () => void;
  onOpenRecord: (recordId: string) => void;
  onAddType: (type: LilicaRecordType) => void;
};

function recentFirst(a: LilicaRecord, b: LilicaRecord) {
  return (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt);
}

function Row({ record, subtitle, onPress }: { record: LilicaRecord; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${record.title}`}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.rowCopy}>
        <AppText variant="bodyStrong" numberOfLines={1}>{record.title}</AppText>
        {subtitle ? <AppText variant="secondary" tone="soft" numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
      <View style={styles.chevron} />
    </Pressable>
  );
}

function conditionSubtitle(record: LilicaRecord): string | undefined {
  const date = formatDateForDisplay(record.diagnosedDate);
  return date ? `Diagnosed ${date}` : undefined;
}

function medicineSubtitle(record: LilicaRecord): string | undefined {
  if (record.medicineSchedule === 'duration') {
    const end = formatDateForDisplay(record.medicineEndDate);
    return end ? `Until ${end}` : 'For a specific duration';
  }
  return 'Repeat / ongoing';
}

function Section({
  heading,
  description,
  addLabel,
  onAdd,
  children,
}: {
  heading: string;
  description: string;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderCopy}>
          <AppText variant="section">{heading}</AppText>
          <AppText variant="secondary" tone="soft">{description}</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={addLabel} onPress={onAdd} hitSlop={8}>
          <AppText variant="secondary" tone="primary" style={styles.addLabel}>Add</AppText>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

export function MedicalLogScreen({ personName, isSelf, records, onBack, onOpenRecord, onAddType }: Props) {
  const name = isSelf ? 'you' : (personName?.trim() || 'them');
  const possessive = isSelf ? 'your' : personName ? `${personName}'s` : 'their';

  const careNeeds = records
    .filter((record) => record.type === 'careNote' && record.status !== 'cancelled')
    .sort(recentFirst);

  const conditions = records.filter((record) => record.type === 'condition').sort(recentFirst);
  const activeConditions = conditions.filter((record) => !record.closedAt);
  const closedConditions = conditions.filter((record) => record.closedAt);

  const medicines = records.filter((record) => record.type === 'medicine').sort(recentFirst);
  const activeMedicines = medicines.filter((record) => !record.closedAt);
  const closedMedicines = medicines.filter((record) => record.closedAt);

  return (
    <Screen>
      <Header title="Medical Log" onBack={onBack} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AppText variant="secondary" tone="soft" style={styles.intro}>
          What {name} need{isSelf ? '' : 's'} help with, and the conditions and medicines it is useful to have on record.
          Lilica records what you tell it -- it does not verify diagnoses or prescriptions, and never gives medical advice.
        </AppText>

        <Section
          heading="Care needs"
          description={`Ongoing support ${possessive} needs`}
          addLabel="Add a care need"
          onAdd={() => onAddType('careNote')}
        >
          {careNeeds.length > 0 ? (
            <View style={styles.list}>
              {careNeeds.map((record) => (
                <Row key={record.id} record={record} onPress={() => onOpenRecord(record.id)} />
              ))}
            </View>
          ) : (
            <AppText variant="secondary" tone="soft">
              Nothing saved yet -- for example, help getting dressed, mobility support or a regular check-in.
            </AppText>
          )}
        </Section>

        <Section
          heading="Diagnosed conditions"
          description="What has been diagnosed, and whether it's still current"
          addLabel="Add a diagnosed condition"
          onAdd={() => onAddType('condition')}
        >
          {activeConditions.length > 0 ? (
            <View style={styles.list}>
              {activeConditions.map((record) => (
                <Row key={record.id} record={record} subtitle={conditionSubtitle(record)} onPress={() => onOpenRecord(record.id)} />
              ))}
            </View>
          ) : (
            <AppText variant="secondary" tone="soft">No conditions saved yet.</AppText>
          )}
          {closedConditions.length > 0 ? (
            <View style={styles.pastGroup}>
              <AppText variant="meta" tone="muted">Past / closed</AppText>
              <View style={styles.list}>
                {closedConditions.map((record) => (
                  <Row key={record.id} record={record} subtitle={conditionSubtitle(record)} onPress={() => onOpenRecord(record.id)} />
                ))}
              </View>
            </View>
          ) : null}
        </Section>

        <Section
          heading="Prescribed medicines"
          description="Current and past medicines"
          addLabel="Add a prescribed medicine"
          onAdd={() => onAddType('medicine')}
        >
          {activeMedicines.length > 0 ? (
            <View style={styles.list}>
              {activeMedicines.map((record) => (
                <Row key={record.id} record={record} subtitle={medicineSubtitle(record)} onPress={() => onOpenRecord(record.id)} />
              ))}
            </View>
          ) : (
            <AppText variant="secondary" tone="soft">No medicines saved yet.</AppText>
          )}
          {closedMedicines.length > 0 ? (
            <View style={styles.pastGroup}>
              <AppText variant="meta" tone="muted">Past / closed</AppText>
              <View style={styles.list}>
                {closedMedicines.map((record) => (
                  <Row key={record.id} record={record} subtitle={medicineSubtitle(record)} onPress={() => onOpenRecord(record.id)} />
                ))}
              </View>
            </View>
          ) : null}
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  intro: { lineHeight: 19 },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  sectionHeaderCopy: { flex: 1, gap: 2 },
  addLabel: { fontWeight: '700' },
  list: { gap: spacing.xxs },
  pastGroup: { gap: spacing.xxs, marginTop: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
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
