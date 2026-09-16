import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { SecondaryDisclosureRow, SecondaryPageIntro, SecondaryRolePill, SecondarySection } from '../components/SecondaryPage';
import { CalendarIcon, FileTextIcon, HeartHandshakeIcon, HistoryIcon, HomeIcon, PhoneIcon, ToDoIcon } from '../components/foundationIcons';
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
  const sectionVisual = (key: string) => {
    if (key === 'needsAttention') return { icon: ToDoIcon, tone: 'rose' as const };
    if (key === 'comingUp') return { icon: CalendarIcon, tone: 'plum' as const };
    if (key === 'keyContacts') return { icon: PhoneIcon, tone: 'blue' as const };
    if (key === 'careCircle') return { icon: HeartHandshakeIcon, tone: 'green' as const };
    if (key === 'documents') return { icon: FileTextIcon, tone: 'plum' as const };
    if (key === 'recentActivity') return { icon: HistoryIcon, tone: 'neutral' as const };
    return { icon: HomeIcon, tone: 'green' as const };
  };

  return (
    <Screen>
      <Header title="Care summary" onBack={onBack} />
      <SecondaryPageIntro>
        A concise picture of {personName || "this person"}'s care situation - useful if someone else needs to step in.
      </SecondaryPageIntro>
      {sections.length === 0 ? (
        <AppText variant="secondary" tone="soft">
          Nothing to summarise yet - add a few records for {personName || 'this person'} and they'll appear here.
        </AppText>
      ) : (
        <View style={styles.sections}>
          {sections.map((section) => (
            <SecondarySection key={section.key} title={section.title} tone={sectionVisual(section.key).tone} style={styles.section}>
              {section.key === 'careCircle' ? (
                <View>
                  {section.members.map((member) => (
                    <SecondaryDisclosureRow
                      key={member.membershipId}
                      icon={HeartHandshakeIcon}
                      iconTone="green"
                      title={member.isSelf ? 'You' : member.displayName}
                      right={<SecondaryRolePill tone={member.role === 'organiser' ? 'plum' : 'blue'}>{roleLabel(member.role)}</SecondaryRolePill>}
                    />
                  ))}
                </View>
              ) : (
                <View>
                  {section.items.map((item) => (
                    <SecondaryDisclosureRow
                      key={item.id}
                      icon={sectionVisual(section.key).icon}
                      iconTone={sectionVisual(section.key).tone}
                      title={item.title}
                      description={item.subtitle}
                      onPress={section.key === 'recentActivity' ? undefined : () => onOpenRecord(item.id)}
                    />
                  ))}
                </View>
              )}
            </SecondarySection>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: {
    gap: spacing.md,
  },
  section: {
    gap: spacing.xxs,
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
