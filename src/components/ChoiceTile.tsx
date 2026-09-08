import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { AppText } from './Text';

type ChoiceTileProps = {
  title: string;
  selected?: boolean;
  onPress: () => void;
};

export function ChoiceTile({ title, selected, onPress }: ChoiceTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.mark, selected && styles.markSelected]} />
      <AppText variant="bodyStrong" tone={selected ? 'white' : 'default'} centre>
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '48%',
    minHeight: 124,
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  mark: {
    width: 28,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.olive,
  },
  markSelected: {
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
