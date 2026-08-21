import type { Locale } from '@/models';

/**
 * The single source of truth for the neighborhood-invite WhatsApp/share
 * message copy. Every share entry point (Invite screen, Settings' "Share
 * Haratna" row) must build its message through this function rather than
 * composing ad hoc strings, so the exact approved copy only lives in one
 * place and stays locale-consistent with the user's current app language.
 */
export function buildInviteMessage(params: { neighborhoodName: string; link: string; locale: Locale }): string {
  const { neighborhoodName, link, locale } = params;
  if (locale === 'ar') {
    return `انضم إلى حارتنا 🏡\n\nمجتمع حي ${neighborhoodName} صار على حارتنا.\n\nتعرف على جيرانك، شارك فعاليات الحي، اكتشف الأماكن القريبة وساعد مجتمعك.\n\nانضم من هنا:\n${link}`;
  }
  return `Join our neighborhood on Haratna 🏡\n\n${neighborhoodName} is now on Haratna.\n\nMeet your neighbors, discover what's happening nearby, join local events and help build our community.\n\nJoin here:\n${link}`;
}
