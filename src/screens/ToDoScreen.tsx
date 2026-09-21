import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FoundationIcon } from '../components/FoundationIcon';
import { BackIcon, ForwardIcon, GridIcon, ListIcon } from '../components/foundationIcons';
import { PlusIcon } from '../components/PlusIcon';
import { PrimaryTabHeader } from '../components/PrimaryTabHeader';
import { NotificationAnchor } from '../components/NotificationBellButton';
import { ScreenBackdrop } from '../components/ScreenBackdrop';
import type { RecordSheetOrigin } from '../components/RecordSheet';
import { AppText } from '../components/Text';
import { CareCircleMember } from '../careCircle';
import { CategoryIcon, categoryLabel, visualFor } from './HomeScreen';
import { careNeedCadenceLabel, DerivedRecordState, deriveRecordState, formatDateForDisplay, isActionableRecord } from '../records';
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
  onOpenRecord: (recordId: string, origin?: RecordSheetOrigin) => void;
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
  notificationCount?: number;
  onOpenNotifications?: (origin?: NotificationAnchor) => void;
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
type ViewMode = 'list' | 'grid';
type TaskGroupKey = 'overdue' | 'today' | 'upcoming' | 'completed';

// Bug found and fixed 20 September 2026 (reported directly: "why doesn't
// this actually show us in the tile what the item is"): overdue/today
// both had `heading: colors.white` against a white/near-white `tile` --
// the record title (and the chevron, which also reads groupVisual.heading)
// was genuinely invisible, not just low-contrast, on both. `colors.ink`
// matches the same dark-on-light pattern upcoming/completed already used
// correctly.
const TASK_GROUP_VISUALS: Record<TaskGroupKey, { tile: string; heading: string; metadata: string }> = {
  overdue: { tile: '#FFFFFF', heading: colors.ink, metadata: colors.danger },
  today: { tile: '#FBF8F4', heading: colors.ink, metadata: colors.inkSoft },
  upcoming: { tile: '#E6F7FE', heading: '#155E8A', metadata: '#356F88' },
  completed: { tile: '#F1F4F5', heading: colors.inkSoft, metadata: colors.inkSoft },
};

const TODO_ICON_COLORS: Partial<Record<LilicaRecord['type'], string>> = {
  task: '#9B71CA',
  bill: '#E46E77',
  homeMatter: '#8A935D',
  appointment: '#258AC3',
};

export function todoGridLayout(windowWidth: number, fontScale: number) {
  const contentWidth = Math.max(windowWidth - (spacing.lg * 2), 0);
  const singleColumn = contentWidth < 300 || fontScale >= 1.3;
  return {
    columns: singleColumn ? 1 : 2,
    tileWidth: singleColumn
      ? contentWidth
      : Math.min(220, Math.max(124, (contentWidth - spacing.sm) / 2)),
  };
}

export function openRecordFromMeasuredRow(
  row: Pick<View, 'measureInWindow'> | null,
  recordId: string,
  onOpenRecord: (recordId: string, origin?: RecordSheetOrigin) => void,
) {
  if (!row || typeof row.measureInWindow !== 'function' || row.measureInWindow.length === 0) {
    onOpenRecord(recordId);
    return;
  }
  row.measureInWindow((x, y, width, height) => onOpenRecord(recordId, { x, y, width, height }));
}

// Same bounded horizon Home's own Coming Up section already uses (see
// docs/CORE_SYSTEM_CONTRACT.md section 9.2), so Upcoming does not fill with
// years of future recurring obligations.
const UPCOMING_HORIZON_DAYS = 30;

// 22 September 2026: real bug -- To Do's grid/list choice lived only in
// useState, and App.tsx remounts this whole screen every time the tab
// becomes active (see the Props comment on initialFilter above), so it
// silently reset to 'list' on every single tab switch. Not account-scoped
// (unlike src/biometricLock.ts's preference) -- this is a plain device-
// level display preference, not sensitive, no reason to isolate it per
// signed-in account.
const VIEW_MODE_STORAGE_KEY = 'lilica_todo_view_mode';

// "Unassigned"/"You" are exactly as before (Phase 9); a third case
// resolves any OTHER assignee to their real Care Circle display name when
// that data is available (Phase 15). Phase 18B: an assignee whose
// membership has since deleted its Lilica account (or was otherwise
// removed) drops out of careCircleMembers -- this used to silently
// render nothing at all; it now says so honestly rather than going
// blank, never a name match, never a fabricated identity, and never
// silently reassigning the work to anyone else.
function assignmentLabel(record: LilicaRecord, activeMembershipId?: string, careCircleMembers?: CareCircleMember[]): string | undefined {
  if (!record.assignedMembershipId) return 'Unassigned';
  if (activeMembershipId && record.assignedMembershipId === activeMembershipId) return 'You';
  const match = careCircleMembers?.find((member) => member.membershipId === record.assignedMembershipId);
  return match ? match.displayName : 'Assignee no longer available';
}

// Corrective task 8: presentational-only date wording layered on top of
// the EXISTING derived.overdue/dueToday booleans -- deriveRecordState()
// itself is untouched, and this never changes which group (overdue/
// today/upcoming) a record falls into, only how its due date reads in
// the one compact metadata line. "Tomorrow" is a plain local date
// comparison, not a new stored/derived field.
// Recurring care needs (21 September 2026) use eventDate, not dueDate --
// fall back to it here so the date actually shows instead of a blank
// "Overdue · " (the bug this fix corrects), and soften the wording: a
// care need that's not been marked done isn't a blown deadline, it's
// something nobody's confirmed doing yet.
function dueMetaText(record: LilicaRecord, derived: DerivedRecordState): string | undefined {
  if (derived.completed) return undefined;
  const isRecurringCareNeed = record.type === 'careNote' && record.careNoteKind === 'need' && Boolean(record.recurrence);
  const relevantDate = record.dueDate ?? record.eventDate ?? record.date;
  if (derived.overdue) {
    return isRecurringCareNeed
      ? `Not yet marked done · since ${formatDateForDisplay(relevantDate) ?? ''}`
      : `Overdue · ${formatDateForDisplay(relevantDate) ?? ''}`;
  }
  if (derived.dueToday) {
    if (!isRecurringCareNeed) return 'Today';
    return `Not yet marked done ${careNeedCadenceLabel(record.recurrence)}`;
  }
  const dueDate = relevantDate;
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

export function ToDoScreen({ records, personName, activeMembershipId, onOpenRecord, onAddSomething, initialFilter, initialFocusGroup, onOpenSettings, notificationCount = 0, onOpenNotifications, onBack, careCircleMembers }: Props) {
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const rowRefs = useRef<Record<string, View | null>>({});
  const [filter, setFilter] = useState<AssignmentFilter>(initialFilter ?? 'all');
  const [viewMode, setViewModeState] = useState<ViewMode>('list');
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY).then((stored) => {
      if (!cancelled && (stored === 'list' || stored === 'grid')) setViewModeState(stored);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function setViewMode(mode: ViewMode) {
    setViewModeState(mode);
    AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, mode).catch(() => {});
  }

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
  const groupDefs: { key: Exclude<TaskGroupKey, 'completed'>; title: string; items: LilicaRecord[] }[] = [
    { key: 'overdue', title: 'Overdue', items: grouped.overdue },
    { key: 'today', title: 'Today', items: grouped.today },
    { key: 'upcoming', title: 'Upcoming', items: grouped.upcoming },
  ];
  const orderedGroupDefs = initialFocusGroup
    ? [...groupDefs.filter((group) => group.key === initialFocusGroup), ...groupDefs.filter((group) => group.key !== initialFocusGroup)]
    : groupDefs;
  const { tileWidth: taskTileWidth } = todoGridLayout(windowWidth, fontScale);

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
  function renderRow(record: LilicaRecord, groupKey: TaskGroupKey, index: number, total: number) {
    const visual = visualFor(record.type);
    const groupVisual = TASK_GROUP_VISUALS[groupKey];
    const derived = deriveRecordState(record);
    const assignee = assignmentLabel(record, activeMembershipId, careCircleMembers);
    const dueText = dueMetaText(record, derived);
    const metaLine = [dueText, assignee].filter(Boolean).join(' · ');

    return (
      <Pressable
        ref={(node) => { rowRefs.current[record.id] = node; }}
        key={record.id}
        accessibilityRole="button"
        accessibilityLabel={`Open ${record.title}`}
        onPress={() => openRecordFromMeasuredRow(rowRefs.current[record.id], record.id, onOpenRecord)}
        testID={`todo-tile-${record.id}`}
        style={({ pressed }) => [
          viewMode === 'list' ? styles.listRow : styles.gridTile,
          viewMode === 'grid' && { width: taskTileWidth, backgroundColor: groupVisual.tile },
          viewMode === 'list' && { backgroundColor: groupVisual.tile },
          viewMode === 'list' && index < total - 1 && styles.listRowDivider,
          groupKey === 'completed' && styles.rowCompleted,
          pressed && styles.rowPressed,
        ]}
      >
        <View testID={`todo-icon-${record.id}`} style={[styles.iconChip, { backgroundColor: TODO_ICON_COLORS[record.type] ?? visual.accent }]}>
          <CategoryIcon type={record.type} color={colors.white} />
        </View>
        <View style={[styles.rowCopy, viewMode === 'grid' && styles.gridCopy]}>
          <AppText variant="meta" numberOfLines={1} style={[styles.rowCategory, { color: groupVisual.metadata }]}>{categoryLabel(record.type)}</AppText>
          <AppText variant="bodyStrong" style={[styles.rowTitle, { color: groupVisual.heading }]}>{record.title}</AppText>
          {metaLine ? (
            // "Overdue" keeps a restrained warning tone; everything else
            // (including Unassigned/You/a real name) is ordinary quiet
            // metadata text, never a filled capsule/button.
            <AppText variant="secondary" numberOfLines={2} style={[styles.rowMetadata, { color: derived.overdue ? colors.danger : groupVisual.metadata }]}>
              {metaLine}
            </AppText>
          ) : null}
        </View>
        {viewMode === 'list' ? (
          <View style={styles.rowDisclosure}>
            <FoundationIcon icon={ForwardIcon} role="navigation" color={groupVisual.heading} />
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <ScreenBackdrop
      deep={tabAccent.todo.deep}
      tint={tabAccent.todo.tint}
      gap={spacing.xs}
      stretch
      // Background correction (12 September 2026, revised after physical
      // QA twice): `stretch` makes the gradient itself span the full
      // rendered height of the screen (not a fixed 620px block), so the
      // fade continues smoothly all the way to wherever the screen
      // actually ends -- never reaching a flat colour partway down and
      // reading as a seam/cut-off. `stops` holds the approved matte
      // steel blue through the header/subtitle/filter region, then eases
      // through restrained lighter derivatives lower down, reaching a
      // pale blue-grey only in the final stretch. Home/
      // Calendar/People are untouched; they pass neither `stretch` nor
      // `stops`, so ScreenBackdrop's default fixed-height, two-stop fade
      // still renders for them exactly as before.
      stops={[
        { color: tabAccent.todo.deep, location: 0 },
        { color: '#617898', location: 0.28 },
        { color: '#7E93AE', location: 0.58 },
        { color: '#A6B7CA', location: 0.8 },
        { color: tabAccent.todo.tint, location: 1 },
      ]}
    >
      {/* Visual pass: header sits on the shared deep/tint backdrop (see
          ScreenBackdrop) -- title, wordmark, subtitle and the back
          chevron (only shown arriving via a Home strip tap, always
          within the header's own deep region) switch to light-on-dark. */}
      <PrimaryTabHeader
        title="To Do"
        tone="light"
        notificationCount={notificationCount}
        onOpenNotifications={onOpenNotifications}
        leading={onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
              onPress={onBack}
              hitSlop={8}
              style={styles.backButton}
            >
              <FoundationIcon icon={BackIcon} role="navigation" color={colors.white} />
            </Pressable>
          ) : undefined}
        actions={(
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add"
            onPress={onAddSomething}
            style={({ pressed }) => [styles.addButton, pressed && styles.viewButtonPressed]}
          >
            <PlusIcon color={colors.white} />
            <AppText variant="button" tone="white">Add</AppText>
          </Pressable>
        )}
        onOpenSettings={onOpenSettings}
      />

      <View style={styles.contextRow}>
        <AppText variant="body" style={styles.subtitle}>{personName ? `${personName}'s to do list` : 'To do'}</AppText>
        <View accessibilityRole="toolbar" accessibilityLabel="To Do view" style={styles.viewControls}>
          {(['list', 'grid'] as ViewMode[]).map((mode) => {
            const selected = viewMode === mode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityLabel={`${mode === 'list' ? 'List' : 'Grid'} view`}
                accessibilityState={{ selected }}
                onPress={() => setViewMode(mode)}
                style={({ pressed }) => [styles.viewButton, selected && styles.viewButtonSelected, pressed && styles.viewButtonPressed]}
              >
                <FoundationIcon icon={mode === 'list' ? ListIcon : GridIcon} role="navigation" color={selected ? tabAccent.todo.deep : colors.white} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'mine', 'unassigned'] as AssignmentFilter[]).map((option) => {
          const selected = filter === option;
          const label = option === 'all' ? 'All' : option === 'mine' ? 'Mine' : 'Unassigned';
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => setFilter(option)}
              style={[styles.filterChip, selected && styles.filterChipSelected]}
            >
              <AppText variant="secondary" tone="white" style={selected ? styles.filterLabelSelected : styles.filterLabel}>
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
              <View key={key} testID={`todo-group-${key}`} style={styles.group}>
                <AppText variant="section" style={{ color: TASK_GROUP_VISUALS[key].heading }}>{title}</AppText>
                <View testID={`todo-${viewMode}-${key}`} style={viewMode === 'list' ? styles.listRows : styles.gridTiles}>
                  {items.map((record, index) => renderRow(record, key, index, items.length))}
                </View>
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
            <View testID="todo-group-completed" style={styles.group}>
              <AppText variant="section" style={{ color: TASK_GROUP_VISUALS.completed.heading }}>Completed</AppText>
              <View testID={`todo-${viewMode}-completed`} style={viewMode === 'list' ? styles.listRows : styles.gridTiles}>
                {completedItems.map((record, index) => renderRow(record, 'completed', index, completedItems.length))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
      <View testID="todo-bottom-clearance" style={styles.bottomClearance} />
    </ScreenBackdrop>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    // Background correction: without flexGrow, this content container --
    // and therefore ScreenBackdrop's own `stretch`ed height inside it --
    // sized itself to its (sometimes sparse, e.g. "Nothing needs doing
    // right now") children only, ending well above the bottom tab bar
    // and exposing the plain screen background beneath as an accidental
    // block. flexGrow: 1 makes this container fill at least the full
    // scroll viewport when content is short; a genuinely long list still
    // scrolls exactly as before (flexGrow never shrinks content already
    // taller than the viewport).
    flexGrow: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    flexShrink: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    gap: spacing.xxs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  contextRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  viewControls: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  viewButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonSelected: {
    backgroundColor: colors.white,
  },
  viewButtonPressed: {
    opacity: 0.76,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  filterChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipSelected: {
    backgroundColor: '#C71742',
    borderColor: '#C71742',
  },
  filterLabelSelected: {
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  filterLabel: {
    color: colors.white,
  },
  groups: {
    gap: spacing.sm,
  },
  group: {
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    gap: spacing.xxs,
  },
  listRows: {
    gap: spacing.xs,
  },
  gridTiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emptyState: {
    marginTop: spacing.xxs,
  },
  listRow: {
    ...shadow.soft,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  listRowDivider: {
    borderBottomWidth: 0,
  },
  gridTile: {
    ...shadow.soft,
    flexDirection: 'column',
    alignItems: 'flex-start',
    minHeight: 166,
    gap: 3,
    padding: 14,
    borderRadius: radius.sm,
  },
  // Revised on explicit product instruction: the row is now ONE
  // Pressable (no separate completion control on the outside of the
  // tile) -- press feedback matches the app's other card taps.
  rowPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
  rowCompleted: {
    opacity: 0.82,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    minWidth: 0,
    flex: 1,
    gap: 0,
  },
  gridCopy: {
    width: '100%',
    flexGrow: 0,
  },
  rowCategory: {
    fontSize: 12,
    lineHeight: 16,
  },
  rowTitle: {
    fontSize: 17,
    lineHeight: 21,
  },
  rowMetadata: {
    lineHeight: 19,
  },
  rowDisclosure: {
    width: 28,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDisclosure: {
    minHeight: 24,
    marginTop: 'auto',
    alignSelf: 'flex-end',
  },
  completedSection: {
    gap: spacing.sm,
  },
  showCompletedButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.88)',
    justifyContent: 'center',
  },
  showCompletedLabel: {
    fontWeight: '700',
  },
  bottomClearance: {
    height: spacing.xxxl,
  },
});
