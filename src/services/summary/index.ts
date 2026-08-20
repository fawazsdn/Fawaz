import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

/**
 * DailySummaryService — looks like an AI-generated summary card but is
 * built deterministically from mock data so the demo never depends on an
 * external AI API. A future backend can swap this for a real model behind
 * the same `getSummary()` contract.
 */
export interface SummaryService {
  getSummary(neighborhoodId: string): Promise<string>;
}

export const summaryService: SummaryService = {
  async getSummary(neighborhoodId) {
    const s = useStore.getState();
    const now = Date.now();
    const in24h = now + 24 * 3600 * 1000;
    const events = s.events.filter((e) => e.neighborhoodId === neighborhoodId && +new Date(e.startsAt) <= in24h && +new Date(e.startsAt) >= now);
    const activeIssue = s.issues.find((i) => i.neighborhoodId === neighborhoodId && i.status !== 'resolved');
    const foundPet = s.lostFound.find((l) => l.neighborhoodId === neighborhoodId && l.kind === 'pet' && l.status !== 'lost');

    const parts: string[] = [];
    if (events.length > 0) {
      parts.push(`هناك ${events.length === 1 ? 'فعالية واحدة' : `${events.length} فعاليات`} اليوم`);
    }
    if (activeIssue) {
      parts.push(`ويستمر النقاش حول "${activeIssue.title}"`);
    }
    if (foundPet) {
      parts.push(`وتم العثور على ${foundPet.title.includes('قطة') ? 'القطة' : 'الحيوان'} المفقود المنشور سابقًا`);
    }
    if (parts.length === 0) {
      return 'حيّك هادئ اليوم، لا توجد مستجدات كبيرة — فرصة جيدة لتبدأ نقاشًا أو تنظّم فعالية!';
    }
    return parts.join('، ') + '.';
  },
};
