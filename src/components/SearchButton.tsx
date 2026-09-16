import { Pressable, StyleSheet } from 'react-native';

import { colors } from '../theme';
import { phase22Foundation } from '../visualFoundation';
import { FoundationIcon } from './FoundationIcon';
import { SearchIcon } from './foundationIcons';

// Phase 20B, Feature B: the one, simple, unified search entry point for
// the current supported person -- deliberately not a new bottom tab, not
// a menu, just a shared utility control using the approved Lucide family.
export function SearchButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Search"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
    >
      <FoundationIcon icon={SearchIcon} role="utility" color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: phase22Foundation.control.minimumTouchTarget,
    height: phase22Foundation.control.minimumTouchTarget,
    borderRadius: phase22Foundation.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
});
