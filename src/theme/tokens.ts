// Haratna design tokens.
//
// The Haratna brand palette (from the logo direction): Saudi neighborhood,
// palm tree, warm desert/sand, deep Saudi green — calm, premium, welcoming.
// No purple, no neon, no pure black/white as a base surface.
//
//   Haratna Forest   #0D4939  — brand / navigation / primary actions
//   Deep Forest      #07352A  — dark-mode base, pressed states
//   Warm Ivory       #F4EFE3  — light-mode background
//   Sand             #D2B078  — accent, used SPARINGLY (not a dominant UI color)
//   Sage             #83977A  — secondary elements
//   Soft Cream       #E7DDC8  — light-mode surfaces/cards
//   Charcoal Green   #172D27  — primary text
//
// Both themes are the same brand, not an inversion of each other: light
// mode is warm ivory/cream, dark mode is deep forest greens with warm
// ivory text — never generic white-on-black or black-on-white.

export type ColorTokens = {
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  /** Sand — the brand's warm accent. Use sparingly: badges, highlights,
   * milestones, selective emphasis. Never a dominant background/button color. */
  accent: string;
  onAccent: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  border: string;
  divider: string;
  success: string;
  successSurface: string;
  warning: string;
  warningSurface: string;
  danger: string;
  dangerSurface: string;
  info: string;
  infoSurface: string;
  overlay: string;
  shimmer: string;
};

export const lightColors: ColorTokens = {
  background: '#F4EFE3', // Warm Ivory
  backgroundAlt: '#ECE2C9', // deeper ivory, for hero/section bands
  surface: '#FBF7ED', // warm off-white — cards, never pure #FFFFFF
  surfaceElevated: '#FFFDF7', // sheets/modals — a hair lighter, still warm
  primary: '#0D4939', // Haratna Forest
  primaryPressed: '#07352A', // Deep Forest
  onPrimary: '#F4EFE3',
  secondary: '#83977A', // Sage
  onSecondary: '#172D27',
  accent: '#D2B078', // Sand
  onAccent: '#172D27',
  textPrimary: '#172D27', // Charcoal Green
  textSecondary: '#48584F',
  textMuted: '#7C8A7F',
  textOnPrimary: '#F4EFE3',
  border: '#E2D5B7',
  divider: '#EAE0C6',
  success: '#0D4939',
  successSurface: '#E2EBE1',
  warning: '#A9660B',
  warningSurface: '#FBEEDA',
  danger: '#B23B2E',
  dangerSurface: '#FBE7E3',
  info: '#2E6B78',
  infoSurface: '#E1EDEE',
  overlay: 'rgba(23, 45, 39, 0.55)',
  shimmer: '#EAE0C6',
};

export const darkColors: ColorTokens = {
  background: '#081E18', // near-black forest — not generic #000000
  backgroundAlt: '#0C271F',
  surface: '#0F2E25', // slightly lighter green surface for cards
  surfaceElevated: '#153A2F',
  primary: '#3FA07A', // brightened Haratna Forest, legible on dark
  primaryPressed: '#328565',
  onPrimary: '#07231C',
  secondary: '#8FAE8A', // Sage, brightened slightly for dark
  onSecondary: '#07231C',
  accent: '#D2B078', // Sand — stays consistent across themes
  onAccent: '#172D27',
  textPrimary: '#F4EFE3', // Warm Ivory, not harsh pure white
  textSecondary: '#C9C2AC',
  textMuted: '#8FA08F',
  textOnPrimary: '#07231C',
  border: '#1E4A3A',
  divider: '#173C2F',
  success: '#3FA07A',
  successSurface: '#173C2F',
  warning: '#E3A75B',
  warningSurface: '#3A2E1B',
  danger: '#E38073',
  dangerSurface: '#3B211D',
  info: '#7FBFC2',
  infoSurface: '#123234',
  overlay: 'rgba(0, 0, 0, 0.65)',
  shimmer: '#153A2F',
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sheet: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
} as const;

export type ReputationColors = Record<string, { color: string; surface: string }>;
