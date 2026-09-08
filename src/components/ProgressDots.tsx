import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

type ProgressDotsProps = {
  current: number;
  total: number;
  inverse?: boolean;
};

export function ProgressDots({ current, total, inverse }: ProgressDotsProps) {
  return (
    <View accessibilityLabel={`Step ${current} of ${total}`} style={styles.row}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            inverse && styles.inverse,
            index + 1 === current && styles.active,
            inverse && index + 1 === current && styles.inverseActive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    opacity: 0.52,
  },
  active: {
    width: 30,
    backgroundColor: colors.primary,
    opacity: 1,
  },
  inverse: {
    backgroundColor: colors.white,
  },
  inverseActive: {
    backgroundColor: colors.white,
  },
});
