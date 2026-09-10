import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { completionUpdate } from '../components/RecordEditor';
import { Button } from '../components/Button';
import { AppText } from '../components/Text';
import { Wordmark } from '../components/Wordmark';
import { CategoryIcon, categoryLabel, visualFor } from './HomeScreen';
import { deriveRecordState, formatDateForDisplay, isActionableRecord } from '../records';
import { colors, radius, spacing } from '../theme';
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

function assignmentLabel(record: LilicaRecord, activeMembershipId?: string): 'You' | 'Unassigned' | undefined {
  if (!record.assignedMembershipId) return 'Unassigned';
  if (activeMembershipId && record.assignedMembershipId === activeMembershipId) return 'You';
  // A membership ID that isn't the organiser's own doesn't exist under the
  // current Phase 9 scope (Unassigned/You only) -- never fabricate a name.
  return undefined;
}

export function ToDoScreen({ records, personName, activeMembershipId, onOpenRecord, onSaveRecord, onAddSomething }: Props) {
  const [filter, setFilter] = useState<AssignmentFilter>('all');
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

  function markComplete(record: LilicaRecord) {
    onSaveRecord({ ...record, ...completionUpdate(record, true, record.responsiblePerson) });
  }

  function reopen(record: LilicaRecord) {
    onSaveRecord({ ...record, ...completionUpdate(record, false, record.responsiblePerson) });
  }

  function renderRow(record: LilicaRecord, completed: boolean) {
    const visual = visualFor(record.type);
    const derived = deriveRecordState(record);
    const badge = assignmentLabel(record, activeMembershipId);
    const dueLabel = completed
      ? undefined
      : derived.overdue
        ? `Overdue · ${formatDateForDisplay(record.dueDate ?? record.date) ?? ''}`
        : derived.dueToday
          ? 'Due today'
          : (record.dueDate ?? record.date)
            ? `Due ${formatDateForDisplay(record.dueDate ?? record.date)}`
            : 'No due date';

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
            <View style={styles.rowMeta}>
              {dueLabel ? (
                <AppText variant="secondary" tone={derived.overdue ? 'danger' : 'soft'}>{dueLabel}</AppText>
              ) : null}
              {badge ? <View style={styles.assignmentBadge}><AppText variant="meta" tone="soft">{badge}</AppText></View> : null}
            </View>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={completed ? `Reopen ${record.title}` : `${completionLabel(record.type)}: ${record.title}`}
          onPress={() => completed ? reopen(record) : markComplete(record)}
          style={styles.actionButton}
        >
          <AppText variant="secondary" tone="primary" style={styles.actionButtonLabel}>
            {completed ? 'Reopen' : completionLabel(record.type)}
          </AppText>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Wordmark />
        <Button label="Add" onPress={onAddSomething} style={styles.addButton} />
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
          {grouped.overdue.length > 0 ? (
            <View style={styles.group}>
              <AppText variant="section">Overdue</AppText>
              <View style={styles.groupList}>{grouped.overdue.map((record) => renderRow(record, false))}</View>
            </View>
          ) : null}
          {grouped.today.length > 0 ? (
            <View style={styles.group}>
              <AppText variant="section">Today / Needs doing</AppText>
              <View style={styles.groupList}>{grouped.today.map((record) => renderRow(record, false))}</View>
            </View>
          ) : null}
          {grouped.upcoming.length > 0 ? (
            <View style={styles.group}>
              <AppText variant="section">Upcoming</AppText>
              <View style={styles.groupList}>{grouped.upcoming.map((record) => renderRow(record, false))}</View>
            </View>
          ) : null}
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
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  assignmentBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  actionButton: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonLabel: {
    fontWeight: '700',
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
