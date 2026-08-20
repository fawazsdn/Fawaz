import { useStore } from '@/store/useStore';
import { mockDelay } from '../shared';

/**
 * NeighborhoodAssistantService — deterministic, rule-based responses built
 * from current mock data. A future backend can replace this with a real
 * model while keeping the same `ask()` contract.
 */
export interface AssistantService {
  ask(query: string, neighborhoodId: string): Promise<string>;
}

function todayEvents(neighborhoodId: string) {
  const s = useStore.getState();
  const now = Date.now();
  const in24h = now + 24 * 3600 * 1000;
  return s.events.filter((e) => e.neighborhoodId === neighborhoodId && +new Date(e.startsAt) <= in24h && +new Date(e.startsAt) >= now);
}

function computeAnswer(query: string, neighborhoodId: string): string {
  const s = useStore.getState();
  const q = query.trim();

  if (/مباراة|كرة|رياض|football/.test(q)) {
    const matches = todayEvents(neighborhoodId).filter((e) => e.category === 'football' || e.category === 'padel');
    if (matches.length === 0) return 'ما فيه مباريات مجدولة خلال الـ24 ساعة القادمة في حيّك حاليًا.';
    return `فيه ${matches.length} مباراة قريبة: ${matches.map((m) => `"${m.title}" الساعة ${new Date(m.startsAt).toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit' })}`).join('، ')}.`;
  }

  if (/مياه|تسرب|انقطاع/.test(q)) {
    const waterIssues = s.issues.filter((i) => i.neighborhoodId === neighborhoodId && i.category === 'water' && i.status !== 'resolved');
    if (waterIssues.length === 0) return 'ما فيه بلاغات مياه نشطة حاليًا في حيّك، الحمدلله.';
    return `فيه ${waterIssues.length} بلاغ مياه نشط، آخره: "${waterIssues[0]?.title}" — الحالة: ${waterIssues[0]?.status}.`;
  }

  if (/تكييف|ac|كهرباء|كهربائي/.test(q)) {
    const businesses = s.businesses.filter((b) => b.neighborhoodIds.includes(neighborhoodId) && (b.category === 'ac_repair' || b.category === 'electrician'));
    const top = businesses[0];
    if (!top) return 'ما لقيت توصية مناسبة حاليًا، جرب تسأل في قسم التوصيات.';
    return `أعلى توصية: "${top.name}" — أوصى فيه ${top.recommendationCount} جار.`;
  }

  if (/عائل|أطفال|family|kids/.test(q)) {
    const events = s.events.filter((e) => e.neighborhoodId === neighborhoodId && (e.category === 'kids' || e.category === 'family'));
    const first = events[0];
    if (!first) return 'ما فيه فعاليات عائلية مجدولة حاليًا هذا الأسبوع.';
    return `فيه فعالية عائلية: "${first.title}" يوم ${new Date(first.startsAt).toLocaleDateString('ar-SA', { weekday: 'long' })}.`;
  }

  // default: general "what's happening today" summary
  const evts = todayEvents(neighborhoodId);
  const openIssues = s.issues.filter((i) => i.neighborhoodId === neighborhoodId && i.status !== 'resolved');
  const helpOpen = s.helpRequests.filter((h) => h.neighborhoodId === neighborhoodId && h.status === 'open');
  return `اليوم في حيّك: ${evts.length} فعالية، ${openIssues.length} بلاغ مفتوح، و${helpOpen.length} طلب مساعدة من الجيران.`;
}

export const assistantService: AssistantService = {
  async ask(query, neighborhoodId) {
    return mockDelay(computeAnswer(query, neighborhoodId), 600);
  },
};
