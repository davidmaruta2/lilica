import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { AppText } from './Text';

type HeaderProps = {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export function Header({ title, onBack, right }: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            style={styles.back}
          >
            <View style={styles.chevron} />
          </Pressable>
        ) : null}
      </View>
      {title ? (
        <AppText variant="section" centre style={styles.title}>
          {title}
        </AppText>
      ) : (
        <View style={styles.title} />
      )}
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  side: {
    width: 64,
  },
  right: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 15,
    height: 15,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: colors.ink,
    transform: [{ rotate: '45deg' }],
    marginLeft: 5,
  },
});
