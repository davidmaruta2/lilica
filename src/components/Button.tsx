import { ReactNode } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';
import { AppText } from './Text';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'light' | 'text' | 'textLight';
  disabled?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  icon,
  accessibilityLabel,
  style,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'light' && styles.light,
        variant === 'text' && styles.textButton,
        variant === 'textLight' && styles.textButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon}
      <AppText
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        numberOfLines={1}
        style={[
          typography.button,
          styles.label,
          variant === 'primary' && styles.primaryLabel,
          variant === 'light' && styles.lightLabel,
          variant === 'textLight' && styles.textLightLabel,
          variant !== 'primary' && variant !== 'light' && variant !== 'textLight' && styles.secondaryLabel,
          disabled && styles.disabledLabel,
        ]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
  },
  light: {
    backgroundColor: colors.white,
  },
  textButton: {
    minHeight: 44,
    backgroundColor: 'transparent',
  },
  primaryLabel: {
    color: colors.white,
  },
  secondaryLabel: {
    color: colors.primary,
  },
  lightLabel: {
    color: colors.primary,
  },
  textLightLabel: {
    color: colors.white,
  },
  disabled: {
    opacity: 0.48,
  },
  disabledLabel: {
    color: colors.muted,
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
});
