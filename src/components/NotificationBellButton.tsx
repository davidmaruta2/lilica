import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '../theme';
import { phase22Foundation } from '../visualFoundation';
import { FoundationIcon } from './FoundationIcon';
import { BellIcon } from './foundationIcons';
import { AppText } from './Text';

export type NotificationAnchor = { x: number; y: number; width: number; height: number };

type Props = {
  count: number;
  onPress: (origin?: NotificationAnchor) => void;
  tone?: 'dark' | 'light';
};

export function NotificationBellButton({ count, onPress, tone = 'dark' }: Props) {
  const ref = useRef<View>(null);
  const label = count > 0 ? `Notifications, ${count} unread` : 'Notifications';

  function open() {
    if (!ref.current?.measureInWindow) {
      onPress();
      return;
    }
    ref.current.measureInWindow((x, y, width, height) => onPress({ x, y, width, height }));
  }

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={open}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <FoundationIcon icon={BellIcon} role="utility" size={26} color={tone === 'light' ? colors.white : colors.primary} />
      {count > 0 ? (
        <View testID="notification-badge" style={styles.badge}>
          <AppText variant="meta" tone="white" style={styles.badgeText}>{count > 99 ? '99+' : count}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: phase22Foundation.control.minimumTouchTarget,
    height: phase22Foundation.control.minimumTouchTarget,
    borderRadius: phase22Foundation.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  badge: {
    position: 'absolute',
    top: 1,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C71742',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
});
