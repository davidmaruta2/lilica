import { colors, spacing } from './theme';

export const phase22Typography = {
  wordmark: {
    fontFamily: 'Fraunces_800ExtraBold',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800' as const,
    letterSpacing: 0,
  },
  pageTitle: {
    fontFamily: 'InterTight_700Bold',
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  sectionHeading: {
    fontFamily: 'InterTight_700Bold',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  itemTitle: {
    fontFamily: 'InterTight_600SemiBold',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  supporting: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  metadata: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
    letterSpacing: 0,
  },
  control: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
};

export const phase22Foundation = {
  spacing: {
    item: spacing.sm,
    section: spacing.lg,
    page: spacing.lg,
  },
  radius: {
    control: 8,
    surface: 8,
  },
  neutral: {
    canvas: colors.canvas,
    surface: colors.surface,
    line: colors.line,
    ink: colors.ink,
    supportingInk: colors.inkSoft,
  },
  iconSize: {
    navigation: 20,
    utility: 22,
    bottomNavigation: 24,
  },
  control: {
    minimumTouchTarget: 44,
  },
  iconStrokeWidth: 2,
} as const;
