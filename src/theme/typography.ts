import type { Locale } from '@/models';

// Arabic gets Tajawal (a warm, premium geometric Arabic face); English gets
// Plus Jakarta Sans so both scripts share the same rounded, modern character.
export const fontFamilies = {
  ar: {
    regular: 'Tajawal_400Regular',
    medium: 'Tajawal_500Medium',
    bold: 'Tajawal_700Bold',
    extraBold: 'Tajawal_800ExtraBold',
  },
  en: {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    bold: 'PlusJakartaSans_700Bold',
    extraBold: 'PlusJakartaSans_800ExtraBold',
  },
} as const;

export type TypeScaleKey =
  'display' | 'heading1' | 'heading2' | 'heading3' | 'title' | 'body' | 'bodySmall' | 'caption' | 'button' | 'metadata';

interface TypeSpec {
  fontSize: number;
  lineHeight: number;
  weight: 'regular' | 'medium' | 'bold' | 'extraBold';
}

// Arabic script needs slightly taller line-height than Latin at the same
// point size to avoid clipping diacritics/descenders.
export function getTypeScale(locale: Locale): Record<TypeScaleKey, TypeSpec> {
  const extra = locale === 'ar' ? 1.18 : 1.0;
  const lh = (size: number, mult = 1.32) => Math.round(size * mult * extra);
  return {
    display: { fontSize: 34, lineHeight: lh(34, 1.18), weight: 'extraBold' },
    heading1: { fontSize: 28, lineHeight: lh(28, 1.22), weight: 'bold' },
    heading2: { fontSize: 22, lineHeight: lh(22, 1.26), weight: 'bold' },
    heading3: { fontSize: 18, lineHeight: lh(18, 1.3), weight: 'bold' },
    title: { fontSize: 16, lineHeight: lh(16, 1.35), weight: 'medium' },
    body: { fontSize: 15, lineHeight: lh(15, 1.45), weight: 'regular' },
    bodySmall: { fontSize: 13, lineHeight: lh(13, 1.45), weight: 'regular' },
    caption: { fontSize: 12, lineHeight: lh(12, 1.4), weight: 'medium' },
    button: { fontSize: 15, lineHeight: lh(15, 1.2), weight: 'bold' },
    metadata: { fontSize: 12, lineHeight: lh(12, 1.35), weight: 'medium' },
  };
}

export function fontFamilyFor(locale: Locale, weight: TypeSpec['weight']): string {
  return fontFamilies[locale][weight];
}
