import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { phase22Foundation } from '../visualFoundation';
import { AppTab } from '../types';
import { FoundationIcon, FoundationIconComponent } from './FoundationIcon';
import { CalendarIcon, HomeIcon, PeopleIcon, ToDoIcon } from './foundationIcons';
import { AppText } from './Text';

type Props = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
};

// Corrective task 10: the fourth tab is "People" -- "the people involved
// in care" (supported people, key contacts, care circle), not a second
// Home dashboard and not only Care Circle management (that stays reachable
// from inside this tab, and from Settings, as its own destination).
const tabs: Array<{ id: AppTab; label: string; icon: FoundationIconComponent }> = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { id: 'todo', label: 'To Do', icon: ToDoIcon },
  { id: 'person', label: 'People', icon: PeopleIcon },
];

export function TabBar({ active, onChange }: Props) {
  return (
    <View accessibilityRole="tablist" style={styles.wrap}>
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
            <FoundationIcon
              icon={tab.icon}
              role="bottomNavigation"
              color={selected ? colors.primary : colors.muted}
            />
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
    minHeight: 64,
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
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
  active: {
    backgroundColor: colors.primarySoft,
  },
});
