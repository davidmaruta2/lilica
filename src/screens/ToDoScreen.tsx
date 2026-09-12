import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { PlusIcon } from '../components/PlusIcon';
import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { SettingsCogButton } from '../components/SettingsCogButton';
import { AppText } from '../components/Text';
import { Wordmark } from '../components/Wordmark';
import { CareCircleMember } from '../careCircle';
import { CategoryIcon, categoryLabel, visualFor } from './HomeScreen';
import { DerivedRecordState, deriveRecordState, formatDateForDisplay, isActionableRecord } from '../records';
import { colors, radius, shadow, spacing, tabAccent } from '../theme';
import { LilicaRecord } from '../types';

type Props = {
  records: LilicaRecord[];
  personName?: string;
  // The organiser's own membership ID for the active care space -- the
  // same stable identity Phase 9's Assigned-to control already uses.
  // "Mine" and the You/Unassigned badge are derived from this, never from
  // a display name.
  activeMembershipId?: string;
  onOpenRecord: (recordId: string) => void;
  // Revised on explicit product instruction: completing/reopening a
  // record now happens inside the opened editor (RecordEditor's own
  // "Already sorted" checkbox), not from a control on this row itself --
  // this screen no longer calls onSaveRecord directly. Kept in the
  // prop contract (App.tsx still passes it) rather than removed, to
  // avoid disturbing every call site for what is, for this screen, now
  // simply an unused capability.
  onSaveRecord: (record: LilicaRecord) => void;
  onAddSomething: () => void;
  // Corrective task 2: Home's at-a-glance strip navigates here with one of
  // these set as a one-shot initial value (read once at mount -- this
  // screen already remounts fresh every time its tab becomes active, see
  // App.tsx's `key={currentSpace.careSpaceId}` plus the tab-switch
  // conditional render). Every group/filter still renders exactly as it
  // always did -- initialFocusGroup only changes which one appears FIRST,
  // never which records are included, so the full record set the strip's
  // count represented is always still here, just reordered for visibility.
  initialFilter?: AssignmentFilter;
  initialFocusGroup?: 'overdue' | 'today' | 'upcoming';
  // Corrective task 4: app-level Settings entry point, same component and
  // placement as Home/Calendar/People. Omitted (no cog) when not supplied.
  onOpenSettings?: () => void;
  // Reported gap: arriving here via a Home strip tap (Overdue/Due today/
  // Assigned to you) left no way back except the bottom tab bar -- the
  // user had visibly "gone into" To Do from Home, not chosen the To Do
  // tab themselves. App.tsx supplies this only when initialFilter/
  // initialFocusGroup are set (the same explicit signal that already
  // distinguishes a strip-tap entry from an ordinary tab-bar visit, per
  // corrective task 5's "never guess from screen history" discipline),
  // and it returns to Home specifically, not a generic stageOrder walk.
  onBack?: () => void;
  // Corrective task 8: lets the metadata line show a real Care Circle
  // member's own name (e.g. "Tomorrow · Marion") instead of staying
  // silent for anyone who isn't the organiser -- reusing the same real
  // membership data Phase 15's assignment selector already resolves
  // names from, never a name match/guess. Omitted entirely (falls back
  // to exactly the previous Unassigned/You-only behaviour) when not
  // supplied, so no assignment semantics change.
  careCircleMembers?: CareCircleMember[];
};

type AssignmentFilter = 'all' | 'mine' | 'unassigned';

// Same bounded horizon Home's own Coming Up section already uses (see
// docs/CORE_SYSTEM_CONTRACT.md section 9.2), so Upcoming does not fill with
// years of future recurring obligations.
const UPCOMING_HORIZON_DAYS = 30;

// "Unassigned"/"You" are exactly as before (Phase 9); a third case now
// resolves any OTHER assignee to their real Care Circle display name when
// that data is available (Phase 15), never a name match or guess -- if
// the assignee isn't found in careCircleMembers, this stays undefined
// exactly as it always did, rather than fabricating anything.
function assignmentLabel(record: LilicaRecord, activeMembershipId?: string, careCircleMembers?: CareCircleMember[]): string | undefined {
  if (!record.assignedMembershipId) return 'Unassigned';
  if (activeMembershipId && record.assignedMembershipId === activeMembershipId) return 'You';
  return careCircleMembers?.find((member) => member.membershipId === record.assignedMembershipId)?.displayName;
}

// Corrective task 8: presentational-only date wording layered on top of
// the EXISTING derived.overdue/dueToday booleans -- deriveRecordState()
// itself is untouched, and this never changes which group (overdue/
// today/upcoming) a record falls into, only how its due date reads in
// the one compact metadata line. "Tomorrow" is a plain local date
// comparison, not a new stored/derived field.
function dueMetaText(record: LilicaRecord, derived: DerivedRecordState): string | undefined {
  if (derived.completed) return undefined;
  if (derived.overdue) return `Overdue · ${formatDateForDisplay(record.dueDate ?? record.date) ?? ''}`;
  if (derived.dueToday) return 'Today';
  const dueDate = record.dueDate ?? record.date;
  if (!dueDate) return 'No due date';
  const parsed = new Date(`${dueDate}T00:00:00`);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (!Number.isNaN(parsed.getTime())
    && parsed.getFullYear() === tomorrow.getFullYear()
    && parsed.getMonth() === tomorrow.getMonth()
    && parsed.getDate() === tomorrow.getDate()) {
    return 'Tomorrow';
  }
  return formatDateForDisplay(dueDate);
}

export function ToDoScreen({ records, personName, activeMembershipId, onOpenRecord, onAddSomething, initialFilter, initialFocusGroup, onOpenSettings, onBack, careCircleMembers }: Props) {
  const [filter, setFilter] = useState<AssignmentFilter>(initialFilter ?? 'all');
  const [showCompleted, setShowCompleted] = useState(false);

  const actionable = useMemo(() => records.filter(isActionableRecord), [records]);

  const filtered = useMemo(() => {
    if (filter === 'mine') return actionable.filter((record) => activeMembershipId && record.assignedMembershipId === activeMembershipId);
    if (filter === 'unassigned') return actionable.filter((record) => !record.assignedMembershipId);
    return actionable;
  }, [actionable, filter, activeMembershipId]);

  const grouped = useMemo(() => {
    const now = new Date();
    const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + UPCOMING_HORIZON_DAYS);
    const overdue: LilicaRecord[] = [];
    const today: LilicaRecord[] = [];
    const upcoming: LilicaRecord[] = [];

    for (const record of filtered) {
      const derived = deriveRecordState(record);
      if (derived.completed) continue;
      if (derived.overdue) overdue.push(record);
      else if (derived.dueToday) today.push(record);
      else {
        const dueDate = record.dueDate ?? record.date;
        if (!dueDate || new Date(`${dueDate}T00:00:00`) <= horizon) upcoming.push(record);
      }
    }

    const dueDateOf = (record: LilicaRecord) => record.dueDate ?? record.date;
    overdue.sort((a, b) => (dueDateOf(a) ?? '').localeCompare(dueDateOf(b) ?? ''));
    upcoming.sort((a, b) => {
      const left = dueDateOf(a);
      const right = dueDateOf(b);
      if (left && right) return left.localeCompare(right);
      if (left) return -1;
      if (right) return 1;
      return a.title.localeCompare(b.title);
    });

    return { overdue, today, upcoming };
  }, [filtered]);

  const completedItems = useMemo(
    () => actionable
      .filter((record) => deriveRecordState(record).completed)
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    [actionable],
  );

  const hasActiveWork = grouped.overdue.length + grouped.today.length + grouped.upcoming.length > 0;

  // Corrective task 2: promotes the focused group to the top -- the same
  // three groups always render (any non-empty one), just reordered, so
  // the record set never differs from the unfocused view.
  const groupDefs = [
    { key: 'overdue', title: 'Overdue', items: grouped.overdue },
    { key: 'today', title: 'Today / Needs doing', items: grouped.today },
    { key: 'upcoming', title: 'Upcoming', items: grouped.upcoming },
  ];
  const orderedGroupDefs = initialFocusGroup
    ? [...groupDefs.filter((group) => group.key === initialFocusGroup), ...groupDefs.filter((group) => group.key !== initialFocusGroup)]
    : groupDefs;
  // Visual pass: identifies whichever group actually renders FIRST (the
  // first one with items, not just array position 0 -- Overdue can be
  // empty while Today/Upcoming aren't), since only that one heading sits
  // reliably within the backdrop's deep zone.
  const firstVisibleGroupKey = orderedGroupDefs.find((group) => group.items.length > 0)?.key;

  // Revised on explicit product instruction: the row is now ONE tap
  // target (the whole card opens the record), with a plain ">" chevron
  // as a purely visual "enter" affordance -- no second touch zone on the
  // outside of the tile. Marking complete/paid or reopening now happens
  // from INSIDE the opened record, via RecordEditor's own existing
  // "Already sorted" checkbox (src/components/RecordEditor.tsx), which
  // already produces the exact same completed/completedAt/
  // confirmationHistory/status fields as completionUpdate() did here --
  // same bill-vs-task/homeMatter paid-vs-complete distinction, same
  // domain logic, just reached one tap further in rather than as a
  // second control on the card itself.
  function renderRow(record: LilicaRecord) {
    const visual = visualFor(record.type);
    const derived = deriveRecordState(record);
    const assignee = assignmentLabel(record, activeMembershipId, careCircleMembers);
    const dueText = dueMetaText(record, derived);
    const metaLine = [dueText, assignee].filter(Boolean).join(' · ');

    return (
      <Pressable
        key={record.id}
        accessibilityRole="button"
        accessibilityLabel={`Open ${record.title}`}
        onPress={() => onOpenRecord(record.id)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <View style={[styles.iconChip, { backgroundColor: visual.tint }]}>
          <CategoryIcon type={record.type} color={visual.accent} />
        </View>
        <View style={styles.rowCopy}>
          <AppText variant="meta" tone="muted" numberOfLines={1}>{categoryLabel(record.type)}</AppText>
          <AppText variant="bodyStrong" numberOfLines={2}>{record.title}</AppText>
          {metaLine ? (
            // "Overdue" keeps a restrained warning tone; everything else
            // (including Unassigned/You/a real name) is ordinary quiet
            // metadata text, never a filled capsule/button.
            <AppText variant="secondary" tone={derived.overdue ? 'danger' : 'soft'} numberOfLines={1}>
              {metaLine}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <ScreenBackdrop deep={tabAccent.todo.deep} tint={tabAccent.todo.tint} gap={spacing.md}>
      {/* Visual pass: header sits on the shared deep/tint backdrop (see
          ScreenBackdrop) -- title, wordmark, subtitle and the back
          chevron (only shown arriving via a Home strip tap, always
          within the header's own deep region) switch to light-on-dark. */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
              onPress={onBack}
              hitSlop={8}
              style={styles.backButton}
            >
              <View style={styles.backChevron} />
            </Pressable>
          ) : null}
          <View>
            <Wordmark size="compact" tone="light" />
            <AppText variant="title" tone="white">To Do</AppText>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Button label="Add" variant="light" icon={<PlusIcon color={colors.primary} />} onPress={onAddSomething} style={styles.addButton} />
          {onOpenSettings ? <SettingsCogButton onPress={onOpenSettings} /> : null}
        </View>
      </View>

      <AppText variant="body" style={styles.subtitle}>{personName ? `${personName}'s to do list` : 'To do'}</AppText>

      <View style={styles.filterRow}>
        {(['all', 'mine', 'unassigned'] as AssignmentFilter[]).map((option) => {
          const selected = filter === option;
          const label = option === 'all' ? 'All' : option === 'mine' ? 'Mine' : 'Unassigned';
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(option)}
              style={[styles.filterChip, selected && styles.filterChipSelected]}
            >
              <AppText variant="secondary" tone={selected ? 'white' : 'soft'} style={selected ? styles.filterLabelSelected : undefined}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {hasActiveWork ? (
        <View style={styles.groups}>
          {/* Corrective task 2: same three groups, same records, same
              non-empty-only filtering as always -- initialFocusGroup only
              changes which order they render in, so a chip's destination
              always shows every record the tapped count represented. */}
          {orderedGroupDefs.map(({ key, title, items }) => (
            items.length > 0 ? (
              <View key={key} style={styles.group}>
                {/* Explicit product direction: "Today / Needs doing"
                    is always white, regardless of whether Overdue
                    renders above it -- not just whichever group happens
                    to render first. */}
                <AppText variant="section" tone={key === 'today' || key === firstVisibleGroupKey ? 'white' : 'default'}>{title}</AppText>
                <View style={styles.groupList}>{items.map((record) => renderRow(record))}</View>
              </View>
            ) : null
          ))}
        </View>
      ) : (
        <AppText variant="secondary" style={[styles.emptyState, styles.subtitle]}>Nothing needs doing right now.</AppText>
      )}

      {completedItems.length > 0 ? (
        <View style={styles.completedSection}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showCompleted ? 'Hide completed' : 'Show completed'}
            onPress={() => setShowCompleted((current) => !current)}
            style={styles.showCompletedButton}
          >
            <AppText variant="secondary" tone="primary" style={styles.showCompletedLabel}>
              {showCompleted ? 'Hide completed' : `Show completed (${completedItems.length})`}
            </AppText>
          </Pressable>
          {showCompleted ? (
            <View style={styles.group}>
              <View style={styles.groupList}>{completedItems.map((record) => renderRow(record))}</View>
            </View>
          ) : null}
        </View>
      ) : null}
    </ScreenBackdrop>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same drawn-chevron technique as Header.tsx's own back chevron. Always
  // white -- this only ever appears inside the header, which always sits
  // on the backdrop's deep zone.
  backChevron: {
    width: 12,
    height: 12,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.white,
    transform: [{ rotate: '45deg' }],
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addButton: {
    width: 'auto',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    gap: spacing.xxs,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  filterChip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterLabelSelected: {
    fontWeight: '700',
  },
  groups: {
    gap: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  // Product direction: To Do's cards now lay out as a 2-up grid of tiles,
  // in line with People's own Key contacts/Care circle tiles.
  groupList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emptyState: {
    marginTop: spacing.xxs,
  },
  // Corrective task 8: radius.lg + shadow.soft matches the "elevated
  // card" language Home's own record cards already use elsewhere in the
  // app -- more breathing room (padding bumped from spacing.sm to
  // spacing.md) and a more premium feel, not a new visual language.
  // Visual pass: pure white (not colors.surface) so every row matches
  // the "white cards on a coloured backdrop" treatment now used across
  // Home/Calendar/People too.
  // Product direction: as a 2-up tile rather than a full-width row, the
  // icon now sits above the text (not squeezed beside it) so the title/
  // meta text can spread out across the tile's own full width instead of
  // being crushed into half a row's worth of space.
  row: {
    width: '48%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.soft,
  },
  // Revised on explicit product instruction: the row is now ONE
  // Pressable (no separate completion control on the outside of the
  // tile) -- press feedback matches the app's other card taps.
  rowPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    width: '100%',
    gap: 2,
  },
  completedSection: {
    gap: spacing.sm,
  },
  showCompletedButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
  },
  showCompletedLabel: {
    fontWeight: '700',
  },
});
