import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

// Approved calendar layout correction (visual hierarchy only): the
// category key is now a slim, horizontally scrollable white strip
// directly under the title, and the month grid sits on its own white
// card, separated from the warm page background. No calendar/event
// logic below this point was changed -- only JSX structure/order and
// styles.

import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { FoundationIcon } from '../components/FoundationIcon';
import { BackIcon, ForwardIcon } from '../components/foundationIcons';
import { PrimaryTabHeader } from '../components/PrimaryTabHeader';
import { NotificationAnchor } from '../components/NotificationBellButton';
import { AppText } from '../components/Text';
import { CategoryIcon, categoryLabel, StatusIcon, visualFor } from './HomeScreen';
import { calendarDateForRecord, deriveRecordState } from '../records';
import { colors, radius, spacing, tabAccent } from '../theme';
import { LilicaRecord, LilicaRecordType } from '../types';

// The categories that can genuinely appear in Calendar (calendarDateForRecord
// excludes contact/careNote/update), in the priority used to pick which
// icon represents a day that has more than one kind of item on it.
const CALENDAR_TYPE_PRIORITY: LilicaRecordType[] = ['appointment', 'task', 'bill', 'homeMatter', 'document'];

function primaryCategoryFor(dayRecords: LilicaRecord[]): LilicaRecordType {
  for (const type of CALENDAR_TYPE_PRIORITY) {
    if (dayRecords.some((record) => record.type === type)) return type;
  }
  return dayRecords[0].type;
}

type Props = {
  records: LilicaRecord[];
  personName?: string;
  onOpenRecord: (recordId: string) => void;
  // Corrective task 4: app-level Settings entry point, same component and
  // placement as Home/To Do/People. Omitted (no cog) when not supplied.
  onOpenSettings?: () => void;
  notificationCount?: number;
  onOpenNotifications?: (origin?: NotificationAnchor) => void;
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

// Monday-first weekday index (0 = Monday .. 6 = Sunday), matching the
// WEEKDAY_LABELS header and the UK date conventions already used elsewhere
// in the app.
function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function buildMonthGrid(monthStart: Date): Array<{ date: Date; iso: string } | null> {
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const leadingBlanks = mondayIndex(monthStart);
  const cells: Array<{ date: Date; iso: string } | null> = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    cells.push({ date, iso: isoDate(date) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function agendaDetail(record: LilicaRecord): string | undefined {
  if (record.type === 'appointment') return record.eventTime ?? record.time;
  if (record.type === 'document') return record.expiryDate ? 'Expires' : undefined;
  return undefined;
}

export function CalendarScreen({ records, personName, onOpenRecord, onOpenSettings, notificationCount = 0, onOpenNotifications }: Props) {
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => isoDate(today), [today]);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const legendScrollRef = useRef<ScrollView>(null);
  const legendScrollX = useRef(0);
  const legendViewportWidth = useRef(0);
  const legendContentWidth = useRef(0);
  const [canScrollLegendLeft, setCanScrollLegendLeft] = useState(false);
  const [canScrollLegendRight, setCanScrollLegendRight] = useState(false);

  const recordsByDate = useMemo(() => {
    const map = new Map<string, LilicaRecord[]>();
    for (const record of records) {
      const date = calendarDateForRecord(record);
      if (!date) continue;
      const existing = map.get(date);
      if (existing) existing.push(record);
      else map.set(date, [record]);
    }
    return map;
  }, [records]);

  const cells = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const monthLabel = visibleMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const selectedRecords = selectedDate ? recordsByDate.get(selectedDate) ?? [] : [];
  const isCurrentMonth = visibleMonth.getFullYear() === today.getFullYear() && visibleMonth.getMonth() === today.getMonth();

  function updateLegendControls() {
    const epsilon = 4;
    setCanScrollLegendLeft(legendScrollX.current > epsilon);
    setCanScrollLegendRight(
      legendScrollX.current < legendContentWidth.current - legendViewportWidth.current - epsilon,
    );
  }

  function scrollLegendBy(delta: number) {
    const next = Math.max(
      0,
      Math.min(legendScrollX.current + delta, Math.max(legendContentWidth.current - legendViewportWidth.current, 0)),
    );
    legendScrollRef.current?.scrollTo({ x: next, animated: true });
  }

  function changeMonth(delta: number) {
    const next = addMonths(visibleMonth, delta);
    setVisibleMonth(next);
    setSelectedDate(isoDate(next));
  }

  function selectedDateLabel() {
    if (!selectedDate) return '';
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (selectedDate === todayIso) return 'Today';
    return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  return (
    <ScrollView testID="calendar-scroll" style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <ScreenBackdrop
      deep={tabAccent.calendar.deep}
      tint={tabAccent.calendar.tint}
      gap={spacing.md}
      stretch
      stops={[
        { color: tabAccent.calendar.deep, location: 0 },
        { color: '#C97B62', location: 0.28 },
        { color: '#D99A80', location: 0.55 },
        { color: '#E5BDA7', location: 0.78 },
        { color: tabAccent.calendar.tint, location: 1 },
      ]}
    >
      {/* Visual pass: header sits on the shared deep/tint backdrop (see
          ScreenBackdrop) -- title, wordmark and subtitle switch to their
          light-on-dark treatment. */}
      <View style={styles.header}>
        <PrimaryTabHeader title="Calendar" tone="light" notificationCount={notificationCount} onOpenNotifications={onOpenNotifications} onOpenSettings={onOpenSettings} />
        <AppText variant="body" style={styles.subtitle}>{personName ? `${personName}'s calendar` : 'Calendar'}</AppText>
        {!isCurrentMonth ? (
          <View style={styles.headerActionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to today"
              onPress={() => {
                setVisibleMonth(startOfMonth(today));
                setSelectedDate(todayIso);
              }}
              style={styles.todayButton}
            >
              <AppText variant="secondary" tone="primary" style={styles.todayButtonLabel}>Today</AppText>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Approved layout: the category key is now a slim, single-row,
          horizontally scrollable white strip directly under the title --
          replacing the old multi-row wrapping legend that used to sit
          under the calendar. Same categories, same colours/icons/labels,
          same order; only the container and layout changed. */}
      <View style={styles.legendWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scroll calendar key left"
          accessibilityState={{ disabled: !canScrollLegendLeft }}
          disabled={!canScrollLegendLeft}
          onPress={() => scrollLegendBy(-164)}
          style={[styles.legendControl, !canScrollLegendLeft && styles.legendControlDisabled]}
        >
          <FoundationIcon icon={BackIcon} role="navigation" color={canScrollLegendLeft ? colors.white : 'rgba(255,255,255,0.4)'} />
        </Pressable>
        <View testID="calendar-legend-viewport" style={styles.legendCard}>
          <ScrollView
            ref={legendScrollRef}
            testID="calendar-legend-scroll"
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.legendRow}
            onLayout={(event) => {
              legendViewportWidth.current = event.nativeEvent.layout.width;
              updateLegendControls();
            }}
            onContentSizeChange={(width) => {
              legendContentWidth.current = width;
              updateLegendControls();
            }}
            onScroll={(event) => {
              legendScrollX.current = event.nativeEvent.contentOffset.x;
              updateLegendControls();
            }}
            scrollEventThrottle={16}
          >
            {CALENDAR_TYPE_PRIORITY.map((type) => {
              const visual = visualFor(type);
              return (
                <View key={type} style={styles.legendItem}>
                  <View style={[styles.legendIcon, { backgroundColor: visual.tint }]}>
                    <CategoryIcon type={type} color={visual.accent} />
                  </View>
                  <AppText variant="secondary" tone="soft" numberOfLines={1} style={styles.legendLabel}>{categoryLabel(type)}</AppText>
                </View>
              );
            })}
            <View style={styles.legendItem}>
              <View style={[styles.legendIcon, { backgroundColor: colors.dangerSoft }]}>
                <StatusIcon icon="alert" color={colors.danger} />
              </View>
              <AppText variant="secondary" tone="soft" numberOfLines={1} style={styles.legendLabel}>Needs attention</AppText>
            </View>
          </ScrollView>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scroll calendar key right"
          accessibilityState={{ disabled: !canScrollLegendRight }}
          disabled={!canScrollLegendRight}
          onPress={() => scrollLegendBy(164)}
          style={[styles.legendControl, !canScrollLegendRight && styles.legendControlDisabled]}
        >
          <FoundationIcon icon={ForwardIcon} role="navigation" color={canScrollLegendRight ? colors.white : 'rgba(255,255,255,0.4)'} />
        </Pressable>
      </View>

      {/* The approved month grid remains on its own pure-white card.
          Calendar calculations and selection behaviour are unchanged;
          only the internal presentation is refined below. */}
      <View style={styles.calendarCard}>
        <View style={styles.monthBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => changeMonth(-1)} style={styles.monthArrow}>
            <FoundationIcon icon={BackIcon} role="navigation" color={colors.inkSoft} />
          </Pressable>
          <AppText variant="section" style={styles.monthTitle}>{monthLabel}</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => changeMonth(1)} style={styles.monthArrow}>
            <FoundationIcon icon={ForwardIcon} role="navigation" color={colors.inkSoft} />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label) => (
            <AppText key={label} variant="meta" tone="muted" style={styles.weekdayLabel}>{label}</AppText>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((cell, index) => {
            if (!cell) return <View key={`blank-${index}`} style={styles.dayCell} />;
            const isToday = cell.iso === todayIso;
            const isSelected = cell.iso === selectedDate;
            const dayRecords = recordsByDate.get(cell.iso) ?? [];
            const hasOccurrences = dayRecords.length > 0;
            const primaryType = hasOccurrences ? primaryCategoryFor(dayRecords) : undefined;
            const visual = primaryType ? visualFor(primaryType) : undefined;
            const needsAttention = dayRecords.some((record) => deriveRecordState(record).overdue);
            const extra = dayRecords.length - 1;
            const dateLabel = cell.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
            const occurrenceLabel = dayRecords.length === 1 ? '1 event' : `${dayRecords.length} events`;
            return (
              <Pressable
                key={cell.iso}
                accessibilityRole="button"
                accessibilityLabel={`${dateLabel}${dayRecords.length ? `. ${occurrenceLabel}` : ''}${needsAttention ? '. Needs attention' : ''}`}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedDate(cell.iso)}
                style={styles.dayCell}
              >
                <View style={[styles.dayMark, isSelected && styles.dayMarkSelected, !isSelected && isToday && styles.dayMarkToday]}>
                  <AppText
                    variant="body"
                    tone={isSelected ? 'white' : isToday ? 'primary' : 'default'}
                    style={styles.dayNumber}
                  >
                    {cell.date.getDate()}
                  </AppText>
                </View>
                <View style={styles.dayMetaRow}>
                  {primaryType && visual ? (
                    <View testID={`calendar-marker-${cell.iso}`} style={[styles.dayBadge, { backgroundColor: visual.tint }]}>
                      <CategoryIcon type={primaryType} color={visual.accent} />
                      {needsAttention ? <View style={styles.dayBadgeAttention} /> : null}
                    </View>
                  ) : (
                    <View style={styles.dayBadgeSpacer} />
                  )}
                  {extra > 0 ? <AppText variant="meta" tone="muted" style={styles.dayMore}>+{extra}</AppText> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.agenda}>
        {/* Explicit product direction: this heading stays the normal
            dark heading colour (not white) on Calendar specifically. */}
        <AppText variant="section">{selectedDateLabel()}</AppText>
        {selectedRecords.length === 0 ? (
          <AppText variant="secondary" style={styles.emptyState}>Nothing planned for this day.</AppText>
        ) : (
          <View style={styles.agendaList}>
            {selectedRecords.map((record) => {
              const visual = visualFor(record.type);
              const overdue = deriveRecordState(record).overdue;
              const detail = agendaDetail(record);
              return (
                <Pressable
                  key={record.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${record.title}`}
                  onPress={() => onOpenRecord(record.id)}
                  style={({ pressed }) => [styles.agendaRow, pressed && styles.agendaRowPressed]}
                >
                  <View style={[styles.agendaIconChip, { backgroundColor: visual.tint }]}>
                    <CategoryIcon type={record.type} color={visual.accent} />
                  </View>
                  <View style={styles.agendaCopy}>
                    <AppText variant="meta" tone="muted" numberOfLines={1} style={styles.agendaCategory}>{categoryLabel(record.type)}</AppText>
                    <AppText variant="bodyStrong" numberOfLines={2} style={styles.agendaTitle}>{record.title}</AppText>
                    {detail ? <AppText variant="secondary" tone="soft" style={styles.agendaDetail}>{detail}</AppText> : null}
                  </View>
                  {overdue ? (
                    <View style={styles.overduePill}>
                      <AppText variant="secondary" style={styles.overduePillText}>Overdue</AppText>
                    </View>
                  ) : (
                    <FoundationIcon icon={ForwardIcon} role="navigation" color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
      <View testID="calendar-bottom-clearance" style={styles.bottomClearance} />
    </ScreenBackdrop>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Horizontal/top padding now lives on ScreenBackdrop itself (see that
  // component) -- it needs to own that space so its gradient can bleed
  // past it to the true screen edges.
  content: {
    flexGrow: 1,
  },
  header: {
    gap: spacing.xs,
  },
  headerActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  todayButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButtonLabel: {
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
  },
  bottomClearance: {
    height: spacing.xxxl,
  },
  // Approved layout: the whole month grid (nav/heading, weekday row,
  // dates, indicators) sits on its own pure-white card, separated from
  // the warm page background. Kept deliberately plain: proportion and a
  // thin border create separation without unnecessary elevation.
  calendarCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: spacing.xs,
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  monthArrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    flex: 1,
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingTop: spacing.xxs,
    paddingBottom: 2,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  dayMark: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayMarkSelected: {
    backgroundColor: colors.primary,
  },
  dayMarkToday: {
    backgroundColor: colors.primarySoft,
  },
  dayNumber: {
    lineHeight: 21,
  },
  dayMetaRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: 2,
  },
  dayBadge: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeSpacer: {
    width: 20,
    height: 20,
  },
  dayBadgeAttention: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  dayMore: {
    fontSize: 10,
    lineHeight: 14,
  },
  // Approved layout: a slim, pure-white rounded strip -- single row,
  // horizontally scrollable, compact spacing. Replaces the old wrapping
  // multi-row legend that lived under the calendar grid.
  legendWrap: {
    marginHorizontal: -spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendControl: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendControlDisabled: {
    opacity: 0.7,
  },
  legendCard: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  legendIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendLabel: {
    maxWidth: 124,
    lineHeight: 18,
  },
  agenda: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  emptyState: {
    marginTop: spacing.xxs,
  },
  agendaList: {
    gap: spacing.sm,
  },
  // Approved layout: individual event tiles are pure white against the
  // warm Today/agenda background (which is deliberately NOT a card).
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 68,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  agendaRowPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
  agendaIconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaCopy: {
    flex: 1,
    gap: 2,
  },
  agendaCategory: {
    fontSize: 12,
    lineHeight: 16,
  },
  agendaTitle: {
    lineHeight: 21,
  },
  agendaDetail: {
    lineHeight: 19,
  },
  overduePill: {
    backgroundColor: 'rgba(154,62,66,0.12)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overduePillText: {
    color: colors.danger,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
  },
});
