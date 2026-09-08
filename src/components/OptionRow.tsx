import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { AppText } from './Text';

type OptionRowProps = {
  title: string;
  description?: string;
  selected?: boolean;
  onPress: () => void;
  multi?: boolean;
};

export function OptionRow({ title, description, selected, onPress, multi }: OptionRowProps) {
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'button'}
      accessibilityState={{ selected, checked: multi ? selected : undefined }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.selected, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <AppText variant="bodyStrong">{title}</AppText>
        {description ? (
          <AppText variant="secondary" tone="soft" style={styles.description}>
            {description}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.mark, multi && styles.squareMark, selected && styles.markSelected]}>
        {selected ? <View style={multi ? styles.tick : styles.markDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 62,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pressed: {
    opacity: 0.84,
  },
  mark: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareMark: {
    borderRadius: 7,
  },
  markSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  markDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  tick: {
    width: 10,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.white,
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
  copy: {
    flex: 1,
  },
  description: {
    marginTop: 2,
  },
});
