import { ReactNode } from 'react';
import { StyleSheet, Text as RNText, TextProps } from 'react-native';

import { colors, typography } from '../theme';

type Variant = keyof typeof typography;

type AppTextProps = TextProps & {
  children: ReactNode;
  variant?: Variant;
  tone?: 'default' | 'soft' | 'muted' | 'primary' | 'white' | 'success' | 'danger';
  centre?: boolean;
};

export function AppText({
  children,
  variant = 'body',
  tone = 'default',
  centre,
  style,
  ...props
}: AppTextProps) {
  return (
    <RNText
      allowFontScaling
      style={[
        typography[variant],
        styles.base,
        tone === 'soft' && styles.soft,
        tone === 'muted' && styles.muted,
        tone === 'primary' && styles.primary,
        tone === 'white' && styles.white,
        tone === 'success' && styles.success,
        tone === 'danger' && styles.danger,
        centre && styles.centre,
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.ink,
  },
  soft: {
    color: colors.inkSoft,
  },
  muted: {
    color: colors.muted,
  },
  primary: {
    color: colors.primary,
  },
  white: {
    color: colors.white,
  },
  success: {
    color: colors.success,
  },
  danger: {
    color: colors.danger,
  },
  centre: {
    textAlign: 'center',
  },
});
