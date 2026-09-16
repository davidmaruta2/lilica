import { ReactNode } from 'react';
import { StyleSheet, Text as RNText, TextProps, TextStyle } from 'react-native';

import { colors, typography } from '../theme';

type Variant = keyof typeof typography;

type AppTextProps = TextProps & {
  children: ReactNode;
  variant?: Variant;
  tone?: 'default' | 'soft' | 'muted' | 'primary' | 'white' | 'success' | 'danger';
  centre?: boolean;
};

// Phase 22 Batch 2: preserve the established role sizes and line heights,
// while giving every shared role its approved family, weight and zero
// tracking. This keeps the migration central and prevents screen-by-screen
// font overrides from drifting apart.
const foundationTypeByVariant: Record<Variant, TextStyle> = {
  wordmark: { fontFamily: 'Fraunces_800ExtraBold', fontWeight: '800', letterSpacing: 0 },
  hero: { fontFamily: 'InterTight_700Bold', fontWeight: '700', letterSpacing: 0 },
  display: { fontFamily: 'InterTight_700Bold', fontWeight: '700', letterSpacing: 0 },
  title: { fontFamily: 'InterTight_700Bold', fontWeight: '700', letterSpacing: 0 },
  section: { fontFamily: 'InterTight_700Bold', fontWeight: '700', letterSpacing: 0 },
  body: { fontFamily: 'Inter_400Regular', fontWeight: '400', letterSpacing: 0 },
  bodyStrong: { fontFamily: 'InterTight_600SemiBold', fontWeight: '600', letterSpacing: 0 },
  secondary: { fontFamily: 'Inter_400Regular', fontWeight: '400', letterSpacing: 0 },
  button: { fontFamily: 'Inter_600SemiBold', fontWeight: '600', letterSpacing: 0 },
  meta: { fontFamily: 'Inter_500Medium', fontWeight: '500', letterSpacing: 0 },
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
        foundationTypeByVariant[variant],
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
