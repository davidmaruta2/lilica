import { useFonts } from 'expo-font';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextStyle, View } from 'react-native';

import { appFontAssets } from '../fontAssets';
import { colors } from '../theme';
import { phase22Foundation, phase22Typography } from '../visualFoundation';
import { FoundationIcon } from './FoundationIcon';
import { BackIcon, CalendarIcon, HomeIcon, PeopleIcon, SettingsIcon, ToDoIcon } from './foundationIcons';

type TypographyRole = keyof typeof phase22Typography;

const navItems = [
  { label: 'Home', icon: HomeIcon, selected: true },
  { label: 'Calendar', icon: CalendarIcon, selected: false },
  { label: 'To Do', icon: ToDoIcon, selected: false },
  { label: 'People', icon: PeopleIcon, selected: false },
];

export function Phase22FoundationPreview() {
  const [fontsLoaded] = useFonts(appFontAssets);
  const [largeText, setLargeText] = useState(false);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const type = (role: TypographyRole): TextStyle => {
    const base = phase22Typography[role];
    if (!largeText) return base;
    return {
      ...base,
      fontSize: Math.round(base.fontSize * 1.3),
      lineHeight: Math.round(base.lineHeight * 1.3),
    };
  };

  return (
    <ScrollView
      testID="phase22-foundation-preview"
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <View style={styles.previewControls}>
        <Text allowFontScaling style={type('metadata')}>Preview text size</Text>
        <View style={styles.segmentedControl}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use normal preview text"
            accessibilityState={{ selected: !largeText }}
            onPress={() => setLargeText(false)}
            style={[styles.segment, !largeText && styles.segmentSelected]}
          >
            <Text allowFontScaling style={[type('supporting'), !largeText && styles.segmentTextSelected]}>Normal</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use larger preview text"
            accessibilityState={{ selected: largeText }}
            onPress={() => setLargeText(true)}
            style={[styles.segment, largeText && styles.segmentSelected]}
          >
            <Text allowFontScaling style={[type('supporting'), largeText && styles.segmentTextSelected]}>Larger</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" style={styles.iconTarget}>
          <FoundationIcon icon={BackIcon} role="navigation" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text allowFontScaling style={type('wordmark')}>Lilica</Text>
          <Text allowFontScaling style={type('pageTitle')}>David's week</Text>
          <Text allowFontScaling style={[type('supporting'), styles.soft]}>
            A calm view of what matters today.
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" style={styles.iconTarget}>
          <FoundationIcon icon={SettingsIcon} role="utility" color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text allowFontScaling style={type('sectionHeading')}>Today</Text>
        <View style={styles.recordRow}>
          <View style={styles.dateBadge}>
            <Text allowFontScaling style={[type('metadata'), styles.primaryText]}>16</Text>
            <Text allowFontScaling style={[type('metadata'), styles.primaryText]}>SEP</Text>
          </View>
          <View style={styles.recordCopy}>
            <Text allowFontScaling style={type('itemTitle')}>Dentist check-up</Text>
            <Text allowFontScaling style={[type('metadata'), styles.soft]}>10:30 · Lister Hospital</Text>
            <Text allowFontScaling style={[type('body'), styles.bodySpacing]}>
              David's appointment is confirmed. Marion is taking him.
            </Text>
          </View>
        </View>
        <Text allowFontScaling style={[type('supporting'), styles.soft]}>
          Notes and supporting information remain readable without competing with the record title.
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="View appointment" style={styles.primaryButton}>
          <Text allowFontScaling style={[type('control'), styles.buttonText]}>View appointment</Text>
        </Pressable>
      </View>

      <View accessibilityRole="tablist" style={styles.bottomNav}>
        {navItems.map((item) => (
          <View key={item.label} style={[styles.navItem, item.selected && styles.navItemSelected]}>
            <FoundationIcon
              icon={item.icon}
              role="bottomNavigation"
              color={item.selected ? colors.primary : colors.muted}
            />
            <Text allowFontScaling style={[type('metadata'), item.selected ? styles.primaryText : styles.mutedText]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: phase22Foundation.neutral.canvas,
  },
  content: {
    padding: phase22Foundation.spacing.page,
    gap: phase22Foundation.spacing.section,
    flexGrow: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: phase22Foundation.neutral.canvas,
  },
  previewControls: {
    gap: 8,
  },
  segmentedControl: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    padding: 3,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  segment: {
    minHeight: 44,
    minWidth: 88,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  segmentSelected: {
    backgroundColor: colors.primary,
  },
  segmentTextSelected: {
    color: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerCopy: {
    flex: 1,
    gap: 5,
  },
  soft: {
    color: phase22Foundation.neutral.supportingInk,
  },
  section: {
    gap: phase22Foundation.spacing.item,
    padding: phase22Foundation.spacing.page,
    borderRadius: phase22Foundation.radius.surface,
    borderWidth: 1,
    borderColor: phase22Foundation.neutral.line,
    backgroundColor: phase22Foundation.neutral.surface,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  dateBadge: {
    width: 52,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
  },
  recordCopy: {
    flex: 1,
  },
  iconTarget: {
    width: phase22Foundation.control.minimumTouchTarget,
    height: phase22Foundation.control.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: phase22Foundation.radius.control,
    backgroundColor: colors.surface,
  },
  bodySpacing: {
    marginTop: 8,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: colors.white,
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 8,
    backgroundColor: colors.surface,
  },
  navItem: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
    borderRadius: 8,
  },
  navItemSelected: {
    backgroundColor: colors.primarySoft,
  },
  primaryText: {
    color: colors.primary,
  },
  mutedText: {
    color: colors.muted,
  },
});
