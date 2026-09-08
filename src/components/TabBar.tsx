import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { AppTab } from '../types';
import { AppText } from './Text';

type Props = {
  active: AppTab;
  personName?: string;
  onChange: (tab: AppTab) => void;
};

const tabs: Array<{ id: AppTab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'todo', label: 'To Do' },
  { id: 'person', label: 'Person' },
];

export function TabBar({ active, personName, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      {tabs.map((tab) => {
        const label = tab.id === 'person' && personName ? personName : tab.label;
        const selected = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            onPress={() => onChange(tab.id)}
            style={[styles.tab, selected && styles.active]}
          >
            <View style={[styles.dot, selected && styles.activeDot]} />
            <AppText variant="secondary" tone={selected ? 'primary' : 'muted'} numberOfLines={1}>
              {label}
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
