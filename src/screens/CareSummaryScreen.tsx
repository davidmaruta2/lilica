import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { ActivityEvent, describeActivityEvent } from '../activity';
import { CareCircleMember } from '../careCircle';
import { buildCareSummary } from '../careSummary';
import { colors, radius, spacing } from '../theme';
import { LilicaRecord } from '../types';

// Phase 20B, Feature C: "Care summary" -- the name chosen over "Emergency
// Medical Record"/"Emergency Mode" (explicitly forbidden by the brief;
// Lilica is not a clinical/emergency system) and over "Handover summary"
// (considered, but "Care summary" reads calmer and fits the existing
// Lilica voice better -- see docs/PHASE_20_ARCHITECTURE.md for the full
// naming discussion). Answers "if I needed to understand this person's
// care situation quickly, what would I need to know" -- deliberately NOT
// a reproduction of Home's own "what needs my attention right now" job.
// Every section is a bounded projection of data already loaded elsewhere
// in the app (see src/careSummary.ts) -- no new data, no new store.
type Props = {
  records: LilicaRecord[];
  careCircleMembers: CareCircleMember[];
  recentActivity: ActivityEvent[];
  personName?: string;
  onBack: () => void;
  onOpenRecord: (recordId: string) => void;
};

function roleLabel(role: CareCircleMember['role']) {
  if (role === 'organiser') return 'Organiser';
  if (role === 'contributor') return 'Contributor';
  return 'Viewer';
}

export function CareSummaryScreen({ records, careCircleMembers, recentActivity, personName, onBack, onOpenRecord }: Props) {
  const sections = buildCareSummary(records, careCircleMembers, recentActivity, describeActivityEvent);

  return (
    <Screen>
      <Header title="Care summary" onBack={onBack} />
      <AppText variant="secondary" tone="soft" style={styles.intro}>
        A concise picture of {personName || "this person"}'s care situation — useful if someone else needs to step in.
      </AppText>
      {sections.length === 0 ? (
        <AppText variant="secondary" tone="soft">
          Nothing to summarise yet — add a few records for {personName || 'this person'} and they'll appear here.
        </AppText>
      ) : (
        <View style={styles.sections}>
          {sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <AppText variant="section">{section.title}</AppText>
              {section.key === 'careCircle' ? (
                <View style={styles.chipRow}>
                  {section.members.map((member) => (
                    <View key={member.membershipId} style={styles.chip}>
                      <AppText variant="secondary">{member.isSelf ? 'You' : member.displayName}</AppText>
                      <AppText variant="meta" tone="soft">{roleLabel(member.role)}</AppText>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.itemList}>
                  {section.items.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole={section.key === 'recentActivity' ? undefined : 'button'}
                      accessibilityLabel={item.title}
                      onPress={section.key === 'recentActivity' ? undefined : () => onOpenRecord(item.id)}
                      style={styles.row}
                    >
                      <View style={styles.rowCopy}>
                        <AppText variant="body" numberOfLines={2}>{item.title}</AppText>
                        {item.subtitle ? <AppText variant="secondary" tone="soft" numberOfLines={1}>{item.subtitle}</AppText> : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: spacing.md,
  },
  sections: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  itemList: {
    gap: spacing.xs,
  },
  row: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowCopy: {
    gap: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    gap: 2,
  },
});
