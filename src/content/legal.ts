import type { Locale } from '@/models';
import config from './legal-config.json';
import legal from './legal.json';

export type LegalDoc = 'privacy' | 'terms' | 'guidelines' | 'help' | 'about' | 'deletion';
export const LEGAL_DOCS: LegalDoc[] = ['privacy', 'terms', 'guidelines', 'help', 'about', 'deletion'];

export interface LegalSection {
  h?: string;
  p?: string[];
  li?: string[];
}

export const LEGAL_UPDATED: string = legal.updated;

/**
 * Owner-provided details (legal entity, support email, data region...) live in
 * legal-config.json. Until they are filled in, the app points people to the
 * in-app support form instead of showing a made-up address.
 */
export function fillLegal(text: string, locale: Locale): string {
  const ar = locale === 'ar';
  const fallback = {
    OPERATOR: ar ? 'فريق حارتنا' : 'the Haratna team',
    SUPPORT_EMAIL: ar ? 'نموذج «تواصل مع الدعم» داخل التطبيق' : 'the in-app Contact support form',
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

export function legalDoc(doc: LegalDoc, locale: Locale): { title: string; sections: LegalSection[] } {
  const d = (legal[locale] as Record<string, { title: string; sections: LegalSection[] }>)[doc];
  return {
    title: d.title,
    sections: d.sections.map((s) => ({
      h: s.h ? fillLegal(s.h, locale) : undefined,
      p: s.p?.map((x) => fillLegal(x, locale)),
      li: s.li?.map((x) => fillLegal(x, locale)),
    })),
  };
}

export const SUPPORT_EMAIL: string | null = config.supportEmail || null;
export const WEBSITE_BASE_URL: string | null = config.websiteBaseUrl || null;
