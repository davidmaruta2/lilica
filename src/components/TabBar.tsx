import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { AppTab } from '../types';
import { AppText } from './Text';

type Props = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
};

// Corrective task 10: the fourth tab is "People" -- "the people involved
// in care" (supported people, key contacts, care circle), not a second
// Home dashboard and not only Care Circle management (that stays reachable
// from inside this tab, and from Settings, as its own destination).
const tabs: Array<{ id: AppTab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'todo', label: 'To Do' },
  { id: 'person', label: 'People' },
];

export function TabBar({ active, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.id)}
            style={[styles.tab, selected && styles.active]}
          >
            <View style={[styles.dot, selected && styles.activeDot]} />
            <AppText variant="secondary" tone={selected ? 'primary' : 'muted'} numberOfLines={1} centre style={styles.label}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    gap: spacing.xxs,
    paddingHorizontal: spacing.xxs,
  },
  // Corrective task 5: explicit centring for the (now two-word) "Care
  // Circle" label -- belt-and-suspenders alongside the row's own
  // alignItems: 'center', so it stays centred even if a device's larger
  // accessibility text size pushes it to use its full tab width.
  label: {
    width: '100%',
    textAlign: 'center',
  },
  active: {
    backgroundColor: colors.primarySoft,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
  },
  activeDot: {
    width: 18,
    backgroundColor: colors.primary,
  },
});
