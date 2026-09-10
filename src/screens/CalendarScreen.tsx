import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '../components/Text';
import { Wordmark } from '../components/Wordmark';
import { CategoryIcon, categoryLabel, StatusIcon, visualFor } from './HomeScreen';
import { calendarDateForRecord, deriveRecordState } from '../records';
import { colors, radius, spacing } from '../theme';
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

export function CalendarScreen({ records, personName, onOpenRecord }: Props) {
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => isoDate(today), [today]);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Wordmark />
        {!isCurrentMonth ? (
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
        ) : null}
      </View>

      <AppText variant="body" tone="soft">{personName ? `${personName}'s calendar` : 'Calendar'}</AppText>

      <View style={styles.monthBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => changeMonth(-1)} style={styles.monthArrow}>
          <View style={[styles.chevron, styles.chevronLeft]} />
        </Pressable>
        <AppText variant="section">{monthLabel}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => changeMonth(1)} style={styles.monthArrow}>
          <View style={[styles.chevron, styles.chevronRight]} />
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
          return (
            <Pressable
              key={cell.iso}
              accessibilityRole="button"
              accessibilityLabel={cell.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelectedDate(cell.iso)}
              style={styles.dayCell}
            >
              <View style={[styles.dayMark, isSelected && styles.dayMarkSelected, !isSelected && isToday && styles.dayMarkToday]}>
                <AppText
                  variant="bodyStrong"
                  tone={isSelected ? 'white' : isToday ? 'primary' : 'default'}
                >
                  {cell.date.getDate()}
                </AppText>
              </View>
              {primaryType && visual ? (
                <View style={[styles.dayBadge, { backgroundColor: visual.tint }]}>
                  <CategoryIcon type={primaryType} color={visual.accent} />
                  {needsAttention ? <View style={styles.dayBadgeAttention} /> : null}
                </View>
              ) : (
                <View style={styles.dayBadgeSpacer} />
              )}
              {extra > 0 ? <AppText variant="meta" tone="muted" style={styles.dayMore}>+{extra}</AppText> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        {CALENDAR_TYPE_PRIORITY.map((type) => {
          const visual = visualFor(type);
          return (
            <View key={type} style={styles.legendItem}>
              <View style={[styles.legendIcon, { backgroundColor: visual.tint }]}>
                <CategoryIcon type={type} color={visual.accent} />
              </View>
              <AppText variant="secondary" tone="soft">{categoryLabel(type)}</AppText>
            </View>
          );
        })}
        <View style={styles.legendItem}>
          <View style={[styles.legendIcon, { backgroundColor: colors.dangerSoft }]}>
            <StatusIcon icon="alert" color={colors.danger} />
          </View>
          <AppText variant="secondary" tone="soft">Needs attention</AppText>
        </View>
      </View>

      <View style={styles.agenda}>
        <AppText variant="section">{selectedDateLabel()}</AppText>
        {selectedRecords.length === 0 ? (
          <AppText variant="secondary" tone="soft" style={styles.emptyState}>Nothing planned for this day.</AppText>
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
                  style={styles.agendaRow}
                >
                  <View style={[styles.agendaIconChip, { backgroundColor: visual.tint }]}>
                    <CategoryIcon type={record.type} color={visual.accent} />
                  </View>
                  <View style={styles.agendaCopy}>
                    <AppText variant="meta" tone="muted" numberOfLines={1}>{categoryLabel(record.type)}</AppText>
                    <AppText variant="bodyStrong" numberOfLines={2}>{record.title}</AppText>
                    {detail ? <AppText variant="secondary" tone="soft">{detail}</AppText> : null}
                  </View>
                  {overdue ? (
                    <View style={styles.overduePill}>
                      <AppText variant="secondary" style={styles.overduePillText}>Overdue</AppText>
                    </View>
                  ) : (
                    <AppText variant="section" tone="primary">&gt;</AppText>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
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
  todayButton: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButtonLabel: {
    fontWeight: '700',
  },
  monthBar: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chevron: {
    width: 8,
    height: 8,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.inkSoft,
  },
  chevronLeft: {
    transform: [{ rotate: '45deg' }],
    marginLeft: 2,
  },
  chevronRight: {
    transform: [{ rotate: '225deg' }],
    marginRight: 2,
  },
  weekdayRow: {
    flexDirection: 'row',
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
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.xxs,
  },
  dayMark: {
    width: 34,
    height: 34,
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
  dayBadge: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dayBadgeSpacer: {
    width: 22,
    height: 22,
    marginTop: 2,
  },
  dayBadgeAttention: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  dayMore: {
    fontSize: 9,
    marginTop: 1,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  legendIcon: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agenda: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  emptyState: {
    marginTop: spacing.xxs,
  },
  agendaList: {
    gap: spacing.sm,
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
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
});
