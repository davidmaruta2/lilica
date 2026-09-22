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
  // Phase 23 slice 1: total unread Lilica Chat messages for the signed-in
  // member, shown as a small badge on the Care Circle tab's icon. Omitted
  // or 0 shows no badge at all -- never a fake "0" bubble.
  careCircleUnreadCount?: number;
};

// Corrective task 10 / Phase 23: the fourth tab centres on the Care Circle
// -- supported people, Care Circle members and Lilica Chat -- not a second
// Home dashboard. Renamed from "People" to "Care Circle" (Phase 23) now
// that the page itself is built around Care Circle membership and chat
// rather than a broader "people involved in care" framing; Key contacts
// moved to the Settings drawer in the same change. `id: 'person'` and
// `tabAccent.people` stay as internal identifiers -- only the user-facing
// label/accessibility label changes.
const tabs: Array<{ id: AppTab; label: string; icon: FoundationIconComponent }> = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
  { id: 'todo', label: 'To Do', icon: ToDoIcon },
  { id: 'person', label: 'Care Circle', icon: PeopleIcon },
];

export function TabBar({ active, onChange, careCircleUnreadCount = 0 }: Props) {
  return (
    <View accessibilityRole="tablist" style={styles.wrap}>
      {tabs.map((tab) => {
        const selected = active === tab.id;
        const badgeCount = tab.id === 'person' ? careCircleUnreadCount : 0;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={badgeCount > 0 ? `${tab.label} (${badgeCount} unread)` : tab.label}
            onPress={() => onChange(tab.id)}
            style={[styles.tab, selected && styles.active]}
          >
            <View style={styles.iconWrap}>
              <FoundationIcon
                icon={tab.icon}
                role="bottomNavigation"
                color={selected ? colors.primary : colors.muted}
              />
              {badgeCount > 0 ? (
                <View style={styles.badge}>
                  <AppText variant="meta" tone="white" style={styles.badgeLabel}>
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </AppText>
                </View>
              ) : null}
            </View>
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
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeLabel: {
    fontSize: 10,
    lineHeight: 12,
  },
});
