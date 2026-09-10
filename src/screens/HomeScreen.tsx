import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { AppText } from '../components/Text';
import { Wordmark } from '../components/Wordmark';
import { firstItemOptions } from '../data/options';
import { deriveRecordState, formatDateForDisplay } from '../records';
import { colors, radius, shadow, spacing } from '../theme';
import { CareSpaceSetupStatus, FirstItem, LilicaRecordType, LocalCareSpaceState, OnboardingState } from '../types';
import { PersonSwitcher } from '../components/PersonSwitcher';
import { useState } from 'react';

type Props = {
  state: OnboardingState;
  onAddSomething: () => void;
  onDismissAllSet: () => void;
  people?: LocalCareSpaceState[];
  activeCareSpaceId?: string;
  setupStatus?: CareSpaceSetupStatus;
  onSwitchPerson?: (careSpaceId: string) => void;
  onAddPerson?: () => void;
  onContinueSetup?: () => void;
};

function itemTiming(item: FirstItem) {
  const eventDate = formatDateForDisplay(item.eventDate ?? item.date);
  const dueDate = formatDateForDisplay(item.dueDate ?? item.date);
  if (item.type === 'appointment') return item.eventTime || item.time ? `${eventDate}, ${item.eventTime ?? item.time}` : eventDate;
  if (item.type === 'bill' || item.type === 'task' || item.type === 'homeMatter') return dueDate ? `Due ${dueDate}` : 'No due date';
  if (item.type === 'document' && item.expiryDate) return `Expires ${formatDateForDisplay(item.expiryDate)}`;
  if (item.type === 'contact' && item.role) return item.role;
  return 'Saved for later';
}

// Presentation-only: one combined line instead of two stacked lines. Reuses
// itemTiming() and responsiblePerson exactly as already derived/stored.
function itemMeta(item: FirstItem) {
  const timing = itemTiming(item);
  return item.responsiblePerson ? `${timing} · with ${item.responsiblePerson}` : timing;
}

// Presentation-only: the app's own existing category names, looked up from
// the same firstItemOptions list the onboarding record stack uses, so this
// never drifts out of sync with the real category naming.
function categoryLabel(type: LilicaRecordType) {
  return firstItemOptions.find((option) => option.id === type)?.title ?? type;
}

function sectionFor(item: FirstItem) {
  const derived = deriveRecordState(item);
  if (derived.overdue || derived.dueToday) return 'Needs attention';
  if (item.type === 'appointment' && item.eventDate === new Date().toISOString().slice(0, 10)) return 'Today';
  if (derived.upcoming) return 'Coming up';
  if ((item.type === 'task' || item.type === 'bill' || item.type === 'homeMatter') && derived.unresolved) return 'Needs attention';
  return 'Latest';
}

// Presentation-only tonal treatment per category, built entirely from
// existing theme tokens (no new colors, no new dependency). Only 5 tonal
// tint/accent pairs exist in theme.ts, so the 4 categories outside the
// approved snapshot row (document, contact, careNote, update) reuse the
// closest existing pair by icon shape rather than by color — still
// distinguishable at a glance, still no new token added anywhere.
type CategoryVisual = { tint: string; accent: string };

const CATEGORY_VISUALS: Record<LilicaRecordType, CategoryVisual> = {
  appointment: { tint: colors.blueSoft, accent: colors.blue },
  task: { tint: colors.primarySoft, accent: colors.primary },
  bill: { tint: colors.claySoft, accent: colors.clay },
  homeMatter: { tint: colors.oliveSoft, accent: colors.olive },
  document: { tint: colors.tealSoft, accent: colors.teal },
  contact: { tint: colors.tealSoft, accent: colors.teal },
  careNote: { tint: colors.oliveSoft, accent: colors.olive },
  update: { tint: colors.primarySoft, accent: colors.primary },
};

function visualFor(type: LilicaRecordType): CategoryVisual {
  return CATEGORY_VISUALS[type];
}

// Small drawn icons built from plain Views only — the same technique
// already used elsewhere in this app (Wordmark's leaf mark, PersonSwitcher's
// tick), so this needed no new icon-library dependency.
function CategoryIcon({ type, color }: { type: LilicaRecordType; color: string }) {
  switch (type) {
    case 'appointment':
      return (
        <View style={iconStyles.calendarBody}>
          <View style={[iconStyles.calendarFrame, { borderColor: color }]} />
          <View style={[iconStyles.calendarBar, { backgroundColor: color }]} />
          <View style={[iconStyles.calendarRing, iconStyles.calendarRingLeft, { backgroundColor: color }]} />
          <View style={[iconStyles.calendarRing, iconStyles.calendarRingRight, { backgroundColor: color }]} />
        </View>
      );
    case 'task':
      return <View style={[iconStyles.tick, { borderColor: color }]} />;
    case 'bill':
      return (
        <View style={[iconStyles.coin, { borderColor: color }]}>
          <View style={[iconStyles.coinBar, { backgroundColor: color }]} />
        </View>
      );
    case 'homeMatter':
      return (
        <View style={iconStyles.houseWrap}>
          <View style={[iconStyles.houseRoof, { borderBottomColor: color }]} />
          <View style={[iconStyles.houseBase, { borderColor: color }]} />
        </View>
      );
    case 'document':
      return (
        <View style={[iconStyles.document, { borderColor: color }]}>
          <View style={[iconStyles.documentLine, { backgroundColor: color, width: '100%' }]} />
          <View style={[iconStyles.documentLine, { backgroundColor: color, width: '65%' }]} />
        </View>
      );
    case 'contact':
      return (
        <View style={iconStyles.personWrap}>
          <View style={[iconStyles.personHead, { borderColor: color }]} />
          <View style={[iconStyles.personShoulders, { borderColor: color }]} />
        </View>
      );
    case 'careNote':
      return (
        <View style={iconStyles.plusWrap}>
          <View style={[iconStyles.plusBar, iconStyles.plusBarHorizontal, { backgroundColor: color }]} />
          <View style={[iconStyles.plusBar, iconStyles.plusBarVertical, { backgroundColor: color }]} />
        </View>
      );
    case 'update':
    default:
      return (
        <View style={iconStyles.noteWrap}>
          <View style={[iconStyles.noteLine, { backgroundColor: color }]} />
          <View style={[iconStyles.noteDot, { backgroundColor: color }]} />
        </View>
      );
  }
}

// The four snapshot categories from the approved mockup. Counts are derived
// locally, right here, from the records already loaded into Home — nothing
// is persisted, queried, or added to records.ts. "Open" is the one caption
// that is truthful for every category under the current model: it means
// exactly "not completed" per the existing deriveRecordState(), no more.
// "To do" is a display label for today's `task` record type only — it does
// not claim to be the future Phase 8 actionable-occurrence projection.
const SNAPSHOT_TYPES: LilicaRecordType[] = ['task', 'bill', 'homeMatter', 'appointment'];

export function HomeScreen({
  state,
  onAddSomething,
  people = [],
  activeCareSpaceId,
  setupStatus = 'ready',
  onSwitchPerson = () => undefined,
  onAddPerson = () => undefined,
  onContinueSetup = () => undefined,
}: Props) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const records = state.records.length > 0 ? state.records : state.firstItem ? [state.firstItem] : [];
  const personName = state.supportedPersonName?.trim() || 'Them';
  const sections = ['Needs attention', 'Today', 'Coming up', 'Latest']
    .map((title) => ({ title, records: records.filter((record) => sectionFor(record) === title) }))
    .filter((section) => section.records.length > 0);

  const snapshot = SNAPSHOT_TYPES.map((type) => ({
    type,
    label: type === 'task' ? 'To do' : categoryLabel(type),
    visual: visualFor(type),
    count: records.filter((record) => record.type === type && !deriveRecordState(record).completed).length,
  }));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Wordmark />
        <Button label="Add" onPress={onAddSomething} style={styles.addButton} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Switch person, currently ${personName}`}
        onPress={() => setSwitcherOpen(true)}
        style={styles.switcherCard}
      >
        <View style={styles.switcherIcon}>
          <AppText variant="bodyStrong" tone="primary">{personName.charAt(0).toUpperCase()}</AppText>
        </View>
        <AppText variant="body" tone="soft" style={styles.switcherCopy}>Everything for {personName}, in one place.</AppText>
        {people.length > 1 ? <AppText variant="bodyStrong" tone="primary">v</AppText> : null}
      </Pressable>

      {setupStatus !== 'ready' ? (
        <View style={styles.setupCard}>
          <AppText variant="section">{personName} still needs setting up</AppText>
          <AppText variant="secondary" tone="soft">Finish their privacy and care preferences before adding records.</AppText>
          <Button label="Continue setup" onPress={onContinueSetup} style={styles.emptyButton} />
        </View>
      ) : (
        <>
          {records.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.snapshotRow}>
              {snapshot.map((item) => (
                <View key={item.type} style={styles.snapshotTile}>
                  <View style={styles.snapshotTop}>
                    <View style={[styles.snapshotIconChip, { backgroundColor: item.visual.tint }]}>
                      <CategoryIcon type={item.type} color={item.visual.accent} />
                    </View>
                    <AppText variant="secondary" tone="soft" numberOfLines={1} style={styles.snapshotLabel}>{item.label}</AppText>
                  </View>
                  <View style={styles.snapshotCountRow}>
                    <AppText variant="title" style={styles.snapshotCount}>{item.count}</AppText>
                    <AppText variant="secondary" tone="muted">open</AppText>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : null}

          {sections.length > 0 ? (
            <View style={styles.sections}>
              {sections.map((section) => (
                <View key={section.title} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <AppText variant="section">{section.title}</AppText>
                  </View>
                  <View style={styles.grid}>
                    {section.records.map((item) => {
                      const visual = visualFor(item.type);
                      const overdue = deriveRecordState(item).overdue;
                      return (
                        <View key={item.id} style={styles.card}>
                          <View style={styles.cardTop}>
                            <View style={[styles.cardIconChip, { backgroundColor: visual.tint }]}>
                              <CategoryIcon type={item.type} color={visual.accent} />
                            </View>
                            {overdue ? (
                              <View style={styles.overduePill}>
                                <AppText variant="secondary" style={styles.overduePillText}>Overdue</AppText>
                              </View>
                            ) : null}
                          </View>
                          <AppText variant="meta" tone="muted" numberOfLines={1}>{categoryLabel(item.type)}</AppText>
                          <AppText variant="bodyStrong" numberOfLines={2}>{item.title}</AppText>
                          <AppText variant="secondary" tone="soft" numberOfLines={2}>{itemMeta(item)}</AppText>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <AppText variant="section">Start with one thing you want to keep track of.</AppText>
              <Button label="Add something" onPress={onAddSomething} style={styles.emptyButton} />
            </View>
          )}
        </>
      )}

      <View style={styles.ask}>
        <View>
          <AppText variant="meta" tone="primary">Ask Lilica</AppText>
          <AppText variant="bodyStrong">What is coming up?</AppText>
        </View>
        <View style={styles.askMark}>
          <AppText variant="bodyStrong" tone="white">?</AppText>
        </View>
      </View>

      <PersonSwitcher
        visible={switcherOpen}
        people={people}
        activeId={activeCareSpaceId}
        onClose={() => setSwitcherOpen(false)}
        onSelect={onSwitchPerson}
        onAdd={onAddPerson}
      />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  addButton: {
    width: 'auto',
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  switcherCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switcherIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherCopy: {
    flex: 1,
  },
  setupCard: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.oliveSoft, gap: spacing.sm },
  snapshotRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  snapshotTile: {
    width: 150,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.soft,
  },
  snapshotTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  snapshotIconChip: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snapshotLabel: {
    flex: 1,
  },
  snapshotCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xxs,
  },
  snapshotCount: {
    fontSize: 22,
  },
  sections: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xxs,
    ...shadow.soft,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cardIconChip: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overduePill: {
    backgroundColor: 'rgba(154,62,66,0.12)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  overduePillText: {
    color: colors.danger,
    fontWeight: '700',
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  emptyButton: {
    marginTop: spacing.lg,
  },
  ask: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  askMark: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Shapes for CategoryIcon, built from plain Views/borders only.
const iconStyles = StyleSheet.create({
  calendarBody: {
    width: 16,
    height: 14,
    marginTop: 3,
  },
  calendarFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.6,
    borderRadius: 3,
  },
  calendarBar: {
    position: 'absolute',
    top: 3,
    left: 0,
    right: 0,
    height: 1.4,
  },
  calendarRing: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 5,
    borderRadius: 1,
  },
  calendarRingLeft: { left: 3 },
  calendarRingRight: { right: 3 },
  tick: {
    width: 11,
    height: 7,
    borderLeftWidth: 2.2,
    borderBottomWidth: 2.2,
    transform: [{ rotate: '-45deg' }],
  },
  coin: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinBar: {
    width: 9,
    height: 1.4,
    borderRadius: 1,
  },
  houseWrap: {
    alignItems: 'center',
  },
  houseRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  houseBase: {
    width: 12,
    height: 8,
    borderWidth: 1.6,
    borderTopWidth: 0,
    marginTop: -1,
  },
  document: {
    width: 13,
    height: 16,
    borderWidth: 1.6,
    borderRadius: 2,
    padding: 2.5,
    justifyContent: 'center',
    gap: 2.5,
  },
  documentLine: {
    height: 1.3,
    borderRadius: 1,
  },
  personWrap: {
    alignItems: 'center',
  },
  personHead: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  personShoulders: {
    width: 13,
    height: 7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    marginTop: 1.5,
  },
  plusWrap: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBar: {
    position: 'absolute',
    borderRadius: 1,
  },
  plusBarHorizontal: {
    width: 15,
    height: 2,
  },
  plusBarVertical: {
    width: 2,
    height: 15,
  },
  noteWrap: {
    alignItems: 'center',
    gap: 3,
  },
  noteLine: {
    width: 2,
    height: 8,
    borderRadius: 1,
  },
  noteDot: {
    width: 2.4,
    height: 2.4,
    borderRadius: 1.2,
  },
});
