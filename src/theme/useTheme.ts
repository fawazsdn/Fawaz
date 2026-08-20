import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, radii, shadows, spacing } from './tokens';
import { fontFamilyFor, getTypeScale, type TypeScaleKey } from './typography';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n/useI18n';

export function useTheme() {
  const themeMode = useStore((s) => s.settings.themeMode);
  const systemScheme = useColorScheme();
  const { locale, isRTL } = useI18n();

  const scheme = themeMode === 'system' ? (systemScheme ?? 'light') : themeMode;
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const typeScale = useMemo(() => getTypeScale(locale), [locale]);

  return useMemo(
    () => ({
      scheme: scheme as 'light' | 'dark',
      colors,
      spacing,
      radii,
      shadows,
      isRTL,
      locale,
      /** Returns a ready-to-spread RN text style for a given type scale key. */
      text: (key: TypeScaleKey, colorOverride?: string) => {
        const spec = typeScale[key];
        return {
          fontFamily: fontFamilyFor(locale, spec.weight),
          fontSize: spec.fontSize,
          lineHeight: spec.lineHeight,
          color: colorOverride ?? colors.textPrimary,
          textAlign: isRTL ? ('right' as const) : ('left' as const),
          writingDirection: isRTL ? ('rtl' as const) : ('ltr' as const),
        };
      },
      /** flexDirection helper respecting RTL mirroring. Pass reverse=true to
       * force the opposite visual order regardless of locale. */
      row: (reverse = false) => {
        const shouldReverse = reverse ? !isRTL : isRTL;
        return { flexDirection: shouldReverse ? ('row-reverse' as const) : ('row' as const) };
      },
    }),
    [scheme, colors, isRTL, locale, typeScale],
  );
}

export type Theme = ReturnType<typeof useTheme>;
