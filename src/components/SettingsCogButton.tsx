import { Pressable, StyleSheet } from 'react-native';

import { colors } from '../theme';
import { phase22Foundation } from '../visualFoundation';
import { FoundationIcon } from './FoundationIcon';
import { SettingsIcon } from './foundationIcons';

export function SettingsCogButton({ onPress, tone = 'dark' }: { onPress: () => void; tone?: 'dark' | 'light' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Settings"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
    >
      <FoundationIcon
        icon={SettingsIcon}
        role="utility"
        color={tone === 'light' ? colors.white : colors.primary}
      />
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
    opacity: 0.7,
  },
});
