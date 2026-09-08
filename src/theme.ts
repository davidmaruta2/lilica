export const colors = {
  canvas: '#F7F2EA',
  stage: '#C77C63',
  stageDeep: '#663B51',
  creamStage: '#F2E8DA',
  surface: '#FFFDF9',
  surfaceMuted: '#EDE4D9',
  ink: '#241D1C',
  inkSoft: '#605856',
  muted: '#8A817C',
  line: '#DDD3C9',
  primary: '#63364D',
  primaryPressed: '#4D293B',
  primarySoft: '#F0E1E8',
  olive: '#8D9660',
  oliveSoft: '#EDF0DC',
  clay: '#C96F4D',
  claySoft: '#F5DED1',
  blue: '#6F8998',
  blueSoft: '#E3EBEF',
  success: '#4E7C55',
  warning: '#A05B2B',
  danger: '#9A3E42',
  white: '#FFFFFF',
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44,
  xxxl: 64,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
};

export const typography = {
  wordmark: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  hero: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.25,
  },
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800' as const,
    letterSpacing: -0.45,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.35,
  },
  section: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800' as const,
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500' as const,
    letterSpacing: 0,
  },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  secondary: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
    letterSpacing: 0,
  },
  button: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
};

export const shadow = {
  soft: {
    shadowColor: '#3E2D2B',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
};
