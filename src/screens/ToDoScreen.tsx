import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { completionUpdate } from '../components/RecordEditor';
import { Button } from '../components/Button';
import { PlusIcon } from '../components/PlusIcon';
import { SettingsCogButton } from '../components/SettingsCogButton';
import { AppText } from '../components/Text';
import { Wordmark } from '../components/Wordmark';
import { CareCircleMember } from '../careCircle';
import { CategoryIcon, categoryLabel, visualFor } from './HomeScreen';
import { DerivedRecordState, deriveRecordState, formatDateForDisplay, isActionableRecord } from '../records';
import { colors, radius, shadow, spacing } from '../theme';
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

function completionLabel(type: LilicaRecord['type']): string {
  if (type === 'bill') return 'Mark paid';
  return 'Mark complete';
}

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

export function ToDoScreen({ records, personName, activeMembershipId, onOpenRecord, onSaveRecord, onAddSomething, initialFilter, initialFocusGroup, onOpenSettings, onBack, careCircleMembers }: Props) {
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

  function markComplete(record: LilicaRecord) {
    onSaveRecord({ ...record, ...completionUpdate(record, true, record.responsiblePerson) });
  }

  function reopen(record: LilicaRecord) {
    onSaveRecord({ ...record, ...completionUpdate(record, false, record.responsiblePerson) });
  }

  // Corrective task 8: strict WHAT / WHEN / WHO hierarchy -- category +
  // title read first, one quiet metadata line (due state and assignee
  // together, plain text, never pill-shaped) reads second, and the
  // completion control is a small outlined circle on the right, entirely
  // separate from the tappable row. No domain logic changed here: the
  // same completionUpdate()-backed markComplete()/reopen() handlers, the
  // same accessibility strings ("Mark Water as paid" / "Mark Carpet
  // complete" / "Reopen ..."), the same bill-vs-task/homeMatter paid-vs-
  // complete distinction (that lives in completionLabel()/
  // completionUpdate(), untouched).
  function renderRow(record: LilicaRecord, completed: boolean) {
    const visual = visualFor(record.type);
    const derived = deriveRecordState(record);
    const assignee = assignmentLabel(record, activeMembershipId, careCircleMembers);
    const dueText = dueMetaText(record, derived);
    const metaLine = [dueText, assignee].filter(Boolean).join(' · ');

    return (
      <View key={record.id} style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${record.title}`}
          onPress={() => onOpenRecord(record.id)}
          style={styles.rowMain}
        >
          <View style={[styles.iconChip, { backgroundColor: visual.tint }]}>
            <CategoryIcon type={record.type} color={visual.accent} />
          </View>
          <View style={styles.rowCopy}>
            <AppText variant="meta" tone="muted" numberOfLines={1}>{categoryLabel(record.type)}</AppText>
            <AppText variant="bodyStrong" numberOfLines={2}>{record.title}</AppText>
            {metaLine ? (
              // "Overdue" keeps a restrained warning tone; everything
              // else (including Unassigned/You/a real name) is ordinary
              // quiet metadata text, never a filled capsule/button.
              <AppText variant="secondary" tone={derived.overdue && !completed ? 'danger' : 'soft'} numberOfLines={1}>
                {metaLine}
              </AppText>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={completed ? `Reopen ${record.title}` : `${completionLabel(record.type)}: ${record.title}`}
          onPress={() => completed ? reopen(record) : markComplete(record)}
          hitSlop={8}
          style={styles.completionControl}
        >
          <View style={[styles.completionCircle, completed && styles.completionCircleChecked]}>
            {completed ? <View style={styles.completionTick} /> : null}
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Corrective task 4: same fixed-size Settings cog + repositioned
          Add row as Home -- see HomeScreen.tsx's header comment. */}
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
            <Wordmark size="compact" />
            <AppText variant="title">To Do</AppText>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Button label="Add" icon={<PlusIcon />} onPress={onAddSomething} style={styles.addButton} />
          {onOpenSettings ? <SettingsCogButton onPress={onOpenSettings} /> : null}
        </View>
      </View>

      <AppText variant="body" tone="soft">{personName ? `${personName}'s to do list` : 'To do'}</AppText>

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
                <AppText variant="section">{title}</AppText>
                <View style={styles.groupList}>{items.map((record) => renderRow(record, false))}</View>
              </View>
            ) : null
          ))}
        </View>
      ) : (
        <AppText variant="secondary" tone="soft" style={styles.emptyState}>Nothing needs doing right now.</AppText>
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
              <View style={styles.groupList}>{completedItems.map((record) => renderRow(record, true))}</View>
            </View>
          ) : null}
        </View>
      ) : null}
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
    gap: spacing.md,
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
  // Same drawn-chevron technique as Header.tsx's own back chevron.
  backChevron: {
    width: 12,
    height: 12,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.ink,
    transform: [{ rotate: '45deg' }],
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
  groupList: {
    gap: spacing.sm,
  },
  emptyState: {
    marginTop: spacing.xxs,
  },
  // Corrective task 8: radius.lg + shadow.soft matches the "elevated
  // card" language Home's own record cards already use elsewhere in the
  // app -- more breathing room (padding bumped from spacing.sm to
  // spacing.md) and a more premium feel, not a new visual language.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.soft,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  // Corrective task 8: the completion control is its own separate touch
  // target (a Pressable sibling of rowMain, never overlapping it), a
  // small outlined circle rather than a large filled pill -- so it no
  // longer competes for the row's horizontal space with the category
  // label or crowds the due/assignment metadata.
  completionControl: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionCircleChecked: {
    backgroundColor: colors.primary,
  },
  // Same drawn-tick technique already used for PersonSwitcher's selected
  // check, at the same proportions -- no new visual language.
  completionTick: {
    width: 11,
    height: 7,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.white,
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
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
