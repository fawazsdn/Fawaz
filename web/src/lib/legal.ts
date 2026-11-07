import config from '@/content/shared/legal-config.json';
import legal from '@/content/shared/legal.json';
import type { Locale } from './i18n';

/**
 * The website renders the same legal text as the app (copied from
 * src/content by scripts/sync-content.mjs). Owner details live in
 * legal-config.json; until they are filled in, the text points people to
 * in-app support rather than to a made-up address.
 */
export type LegalDocKey = 'privacy' | 'terms' | 'guidelines' | 'deletion';

export interface LegalSection {
  h?: string;
  p?: string[];
  li?: string[];
}

export const LEGAL_UPDATED: string = legal.updated;

export const SUPPORT_EMAIL: string | null = config.supportEmail || null;
export const OPERATOR = { ar: config.operatorAr || null, en: config.operatorEn || null };

/** Every owner value the public launch needs. Empty ones keep the site in preview mode. */
export const MISSING_LAUNCH_DETAILS: string[] = (
  ['operatorEn', 'operatorAr', 'supportEmail', 'dataRegion', 'emailProvider', 'backupRetention'] as const
).filter((k) => !config[k]);

export function fillLegal(text: string, locale: Locale): string {
  const ar = locale === 'ar';
  const fallback = {
    OPERATOR: ar ? 'فريق حارتنا' : 'the Haratna team',
    SUPPORT_EMAIL: ar
      ? 'نموذج الدعم في موقعنا أو «تواصل مع الدعم» داخل التطبيق'
      : 'the support form on our website or Contact support in the app',
    DATA_REGION: ar ? 'متاح عند الطلب عبر الدعم' : 'available on request through support',
    EMAIL_PROVIDER: ar ? 'متاح عند الطلب عبر الدعم' : 'available on request through support',
    BACKUP_RETENTION: ar ? 'متاح عند الطلب عبر الدعم' : 'available on request through support',
  };
  const values: Record<string, string> = {
    OPERATOR: (ar ? config.operatorAr : config.operatorEn) || fallback.OPERATOR,
    SUPPORT_EMAIL: config.supportEmail || fallback.SUPPORT_EMAIL,
    DATA_REGION: config.dataRegion || fallback.DATA_REGION,
    EMAIL_PROVIDER: config.emailProvider || fallback.EMAIL_PROVIDER,
    BACKUP_RETENTION: config.backupRetention || fallback.BACKUP_RETENTION,
  };
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (_, k: string) => values[k] ?? '');
}

export function legalDoc(doc: LegalDocKey, locale: Locale): { title: string; sections: LegalSection[] } {
  const d = (legal[locale] as unknown as Record<string, { title: string; sections: LegalSection[] }>)[doc];
  return {
    title: d.title,
    sections: d.sections.map((s) => ({
      h: s.h ? fillLegal(s.h, locale) : undefined,
      p: s.p?.map((x) => fillLegal(x, locale)),
      li: s.li?.map((x) => fillLegal(x, locale)),
    })),
  };
}
