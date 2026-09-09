import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { AppText } from './Text';

type ChipProps = {
  title: string;
  selected?: boolean;
  onPress: () => void;
};

export function Chip({ title, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      <AppText
        style={[styles.label, selected && styles.labelSelected]}
        numberOfLines={3}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 132,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  label: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'center',
    color: colors.ink,
  },
  labelSelected: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
});
