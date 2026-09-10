import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';
import { Button } from './Button';
import { AppText } from './Text';

type Mode = 'date' | 'time';
type DateParts = { day: number; month: number; year: number };
type TimeParts = { hour: number; minute: number };
type Props = {
  label: string;
  mode: Mode;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
};

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = Array.from({ length: 201 }, (_, index) => 1900 + index);
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

export function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

export function clampDateParts(parts: DateParts): DateParts {
  return { ...parts, day: Math.min(parts.day, daysInMonth(parts.month, parts.year)) };
}

export function formatWheelDate(parts: DateParts) {
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
}

export function formatWheelTime(parts: TimeParts) {
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

function initialDateParts(value: string): DateParts {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (match) {
    const parsed = clampDateParts({ day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) });
    if (parsed.month >= 1 && parsed.month <= 12 && parsed.year >= 1900 && parsed.year <= 2100 && parsed.day >= 1) return parsed;
  }
  const today = new Date();
  return { day: today.getDate(), month: today.getMonth() + 1, year: today.getFullYear() };
}

function initialTimeParts(value: string): TimeParts {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return { hour, minute };
  }
  const now = new Date();
  return { hour: now.getHours(), minute: now.getMinutes() };
}

type WheelColumnProps = {
  label: string;
  values: number[];
  selected: number;
  format?: (value: number) => string;
  onSelect: (value: number) => void;
};

function WheelColumn({ label, values, selected, format = String, onSelect }: WheelColumnProps) {
  const selectedIndex = Math.max(0, values.indexOf(selected));

  function selectFromScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.max(0, Math.min(values.length - 1, Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT)));
    onSelect(values[index]);
  }

  return (
    <View style={styles.column}>
      <AppText variant="meta" tone="muted" centre>{label}</AppText>
      <FlatList
        data={values}
        key={`${label}-${values.length}-${selectedIndex}`}
        keyExtractor={(item) => String(item)}
        initialScrollIndex={selectedIndex}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        contentContainerStyle={styles.wheelContent}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={selectFromScroll}
        onScrollEndDrag={selectFromScroll}
        testID={`${label.toLowerCase()}-wheel`}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityState={{ selected: item === selected }} onPress={() => onSelect(item)} style={styles.wheelItem}>
            <AppText variant={item === selected ? 'bodyStrong' : 'body'} tone={item === selected ? 'primary' : 'soft'} centre>
              {format(item)}
            </AppText>
          </Pressable>
        )}
      />
    </View>
  );
}

export function DateTimeWheelField({ label, mode, value, onChange, optional }: Props) {
  const [open, setOpen] = useState(false);
  const [dateParts, setDateParts] = useState<DateParts>(() => initialDateParts(value));
  const [timeParts, setTimeParts] = useState<TimeParts>(() => initialTimeParts(value));
  const placeholder = optional ? `Optional - choose ${mode}` : `Choose ${mode}`;
  const days = useMemo(
    () => Array.from({ length: daysInMonth(dateParts.month, dateParts.year) }, (_, index) => index + 1),
    [dateParts.month, dateParts.year],
  );

  function show() {
    setDateParts(initialDateParts(value));
    setTimeParts(initialTimeParts(value));
    setOpen(true);
  }

  function changeDate(patch: Partial<DateParts>) {
    setDateParts((current) => clampDateParts({ ...current, ...patch }));
  }

  function confirm() {
    onChange(mode === 'date' ? formatWheelDate(dateParts) : formatWheelTime(timeParts));
    setOpen(false);
  }

  return (
    <View style={styles.wrap}>
      <AppText variant="secondary" tone="soft" style={styles.label}>{label}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || placeholder}`} onPress={show} style={({ pressed }) => [styles.field, pressed && styles.pressed]}>
        <AppText variant="body" tone={value ? 'default' : 'muted'}>{value || placeholder}</AppText>
      </Pressable>

      <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Close ${label}`} style={styles.backdrop} onPress={() => setOpen(false)} />
          <SafeAreaView edges={['bottom']} style={styles.sheet} testID={`${mode}-picker-sheet`}>
            <View style={styles.header}>
              <Button label="Cancel" variant="text" onPress={() => setOpen(false)} style={styles.action} />
              <AppText variant="bodyStrong" centre style={styles.pickerTitle}>Choose {mode}</AppText>
              <Button label="Done" variant="text" onPress={confirm} style={styles.action} />
            </View>
            <View style={styles.wheels} testID={`${mode}-wheel-selector`}>
              <View pointerEvents="none" style={styles.selection} />
              {mode === 'date' ? (
                <>
                  <WheelColumn label="Day" values={days} selected={dateParts.day} onSelect={(day) => changeDate({ day })} format={(day) => String(day).padStart(2, '0')} />
                  <WheelColumn label="Month" values={MONTHS.map((_, index) => index + 1)} selected={dateParts.month} onSelect={(month) => changeDate({ month })} format={(month) => MONTHS[month - 1]} />
                  <WheelColumn label="Year" values={YEARS} selected={dateParts.year} onSelect={(year) => changeDate({ year })} />
                </>
              ) : (
                <>
                  <WheelColumn label="Hour" values={HOURS} selected={timeParts.hour} onSelect={(hour) => setTimeParts((current) => ({ ...current, hour }))} format={(hour) => String(hour).padStart(2, '0')} />
                  <WheelColumn label="Minute" values={MINUTES} selected={timeParts.minute} onSelect={(minute) => setTimeParts((current) => ({ ...current, minute }))} format={(minute) => String(minute).padStart(2, '0')} />
                </>
              )}
            </View>
            {optional && value ? <Button label={`Clear ${mode}`} variant="text" onPress={() => { onChange(''); setOpen(false); }} style={styles.clear} /> : null}
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { paddingHorizontal: spacing.xs },
  field: { minHeight: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primarySoft, backgroundColor: colors.surface, paddingHorizontal: spacing.md, justifyContent: 'center' },
  pressed: { borderColor: colors.primary, backgroundColor: colors.white },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(36,29,28,0.36)' },
  sheet: { minHeight: 344, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  header: { height: 56, flexDirection: 'row', alignItems: 'center' },
  pickerTitle: { flex: 1 },
  action: { width: 'auto', minWidth: 72, paddingHorizontal: spacing.sm },
  clear: { width: 'auto', alignSelf: 'center', minHeight: 40, marginTop: spacing.xs },
  wheels: { height: ITEM_HEIGHT * VISIBLE_ITEMS + 24, flexDirection: 'row', gap: spacing.xs },
  selection: { position: 'absolute', left: 0, right: 0, top: 24 + ITEM_HEIGHT * 2, height: ITEM_HEIGHT, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  column: { flex: 1 },
  wheelContent: { paddingVertical: ITEM_HEIGHT * 2 },
  wheelItem: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
});
