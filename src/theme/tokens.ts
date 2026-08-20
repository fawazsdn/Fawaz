// Haratna design tokens.
// A restrained, warm palette: sand/off-white surfaces, deep green identity,
// charcoal type. Dark mode is a deliberately designed equivalent, not an
// inversion — deep warm charcoal-greens rather than pure black.

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
  background: '#FAF6EE',
  backgroundAlt: '#F3EDE0',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  primary: '#1F5D45',
  primaryPressed: '#164533',
  onPrimary: '#FFFFFF',
  secondary: '#6E8F72',
  onSecondary: '#FFFFFF',
  textPrimary: '#241F18',
  textSecondary: '#5B5346',
  textMuted: '#8B8274',
  textOnPrimary: '#FFFFFF',
  border: '#E7DFCE',
  divider: '#EFE8D9',
  success: '#1F5D45',
  successSurface: '#E4EFE6',
  warning: '#A9660B',
  warningSurface: '#FBEEDA',
  danger: '#B23B2E',
  dangerSurface: '#FBE7E3',
  info: '#2F6E8C',
  infoSurface: '#E4EFF4',
  overlay: 'rgba(36, 31, 24, 0.55)',
  shimmer: '#EFE8D9',
};

export const darkColors: ColorTokens = {
  background: '#14201B',
  backgroundAlt: '#182620',
  surface: '#1B2A23',
  surfaceElevated: '#22342B',
  primary: '#5FBF93',
  primaryPressed: '#4CA57C',
  onPrimary: '#0E1712',
  secondary: '#8FAE8F',
  onSecondary: '#0E1712',
  textPrimary: '#F3EFE4',
  textSecondary: '#C7C0AF',
  textMuted: '#8E9A90',
  textOnPrimary: '#0E1712',
  border: '#2C3D34',
  divider: '#26362D',
  success: '#5FBF93',
  successSurface: '#20362B',
  warning: '#E3A75B',
  warningSurface: '#3A2E1B',
  danger: '#E38073',
  dangerSurface: '#3B211D',
  info: '#7FBBDA',
  infoSurface: '#1E3038',
  overlay: 'rgba(0, 0, 0, 0.65)',
  shimmer: '#22342B',
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
