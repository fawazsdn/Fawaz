import { useMemo } from 'react';

import ar from './ar';
import en from './en';
import { useStore } from '@/store/useStore';
import type { Locale } from '@/models';

const dictionaries = { ar, en };

/**
 * Central i18n hook. Returns the active locale, a typed `t` dictionary
 * (accessed like `t.common.save`), and `isRTL` for manual layout mirroring.
 * We mirror layout manually (rather than relying solely on native
 * I18nManager, which needs an app restart) so switching language is
 * instant and fully visible in this demo.
 */
export function useI18n() {
  const locale = useStore((s) => s.settings.locale);
  const setLocale = useStore((s) => s.setLocale);
  const dict = dictionaries[locale];
  const isRTL = locale === 'ar';

  const api = useMemo(
    () => ({
      locale,
      isRTL,
      dir: isRTL ? ('rtl' as const) : ('ltr' as const),
      t: dict,
      setLocale: (l: Locale) => setLocale(l),
      toggleLocale: () => setLocale(locale === 'ar' ? 'en' : 'ar'),
    }),
    [locale, isRTL, dict, setLocale],
  );

  return api;
}

export type I18nApi = ReturnType<typeof useI18n>;
