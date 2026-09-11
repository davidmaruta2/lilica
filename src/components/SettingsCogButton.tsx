import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '../theme';

// Corrective task 4: the app-level Settings entry point, consistently
// placed in the top-right of Home/Calendar/To Do/People's header. One
// shared component so all four tabs render the exact same affordance --
// never four separate implementations. Drawn from plain Views (same
// technique already used for CategoryIcon/StatusIcon in HomeScreen.tsx --
// a ring plus four crossing bars gives an eight-tooth cog silhouette), so
// this needed no new icon-library dependency.
//
// Colour/design history, per explicit product feedback: the very first
// version used this same blue tonal chip (matching the strip's tonal-
// icon-chip language) at a LARGE size -- too large for a header icon, so
// it was shrunk down to a plain borderless ink glyph. On further
// feedback, the blue tinted-chip colour/design itself should be kept
// (it's the one deliberately called the "temp" reference to build from)
// -- only the oversized footprint was ever the actual problem. This is
// that same blue chip, at a modest, header-appropriate size instead.
const TOOTH_ANGLES = [0, 45, 90, 135];

function CogIcon() {
  return (
    <View style={styles.cogWrap}>
      {TOOTH_ANGLES.map((angle) => (
        <View key={angle} style={[styles.cogTooth, { transform: [{ rotate: `${angle}deg` }] }]} />
      ))}
      <View style={styles.cogRing} />
    </View>
  );
}

export function SettingsCogButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
    >
      <CogIcon />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
  cogWrap: {
    width: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cogTooth: {
    position: 'absolute',
    width: 2.2,
    height: 17,
    borderRadius: 1.2,
    backgroundColor: colors.blue,
  },
  cogRing: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2.2,
    borderColor: colors.blue,
    backgroundColor: colors.blueSoft,
  },
});
