import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '../theme';

// Phase 20B, Feature B: the one, simple, unified search entry point for
// the current supported person -- deliberately not a new bottom tab, not
// a menu, just a header icon alongside the existing Settings cog (see
// docs/PHASE_20_ARCHITECTURE.md for why Home's header was chosen as the
// single, least-invasive placement). Drawn from plain Views, matching
// SettingsCogButton's own no-icon-library technique -- a ring plus a
// short diagonal handle for a magnifying glass silhouette. Uses the
// existing primarySoft/primary tonal pair already used elsewhere (the
// bright blue Settings chip is explicitly a one-off accent, not reused
// here).
export function SearchButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Search"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
    >
      <View style={styles.glassWrap}>
        <View style={styles.glassRing} />
        <View style={styles.glassHandle} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
  glassWrap: {
    width: 17,
    height: 17,
  },
  glassRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2.2,
    borderColor: colors.primary,
  },
  glassHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 2.2,
    height: 7,
    borderRadius: 1.2,
    backgroundColor: colors.primary,
    transform: [{ rotate: '45deg' }],
  },
});
