import { formatClock, formatShortDate, isSameSaudiDay, localizeDigits, saudiParts, weekdayName } from '@/utils/format';
import type { ReplyLanguage } from './language';
import type { BusinessFocus, IssueFocus, ParsedQuestion, TimeWindow } from './intent';

/**
 * Everything the assistant is allowed to say comes from these records,
 * fetched fresh for each question. If a fetch fails, the engine says so —
 * it never answers "there's nothing" for data it didn't actually check.
 */
export interface AssistantEvent {
  title: string;
  kind: 'event' | 'activity';
  category: string;
  startsAt: string;
  locationLabel: string;
  going: number;
  capacity: number;
  cancelled: boolean;
}
export interface AssistantIssue {
  title: string;
  category: string;
  status: string;
  createdAt: string;
}
export interface AssistantBusiness {
  name: string;
  category: string;
  recommendations: number;
}
export interface AssistantListing {
  title: string;
  listingType: 'sale' | 'free' | 'wanted';
  price?: number;
}
export interface AssistantHelp {
  title: string;
}
export interface AssistantPoll {
  question: string;
  totalVotes: number;
  closesAt: string;
}
export interface AssistantLostFound {
  title: string;
  status: 'lost' | 'found' | 'reunited';
  kind: 'pet' | 'item';
}

export interface AssistantDataSource {
  events(fromIso: string, toIso: string): Promise<AssistantEvent[]>;
  openIssues(): Promise<AssistantIssue[]>;
  businesses(): Promise<AssistantBusiness[]>;
  listings(): Promise<AssistantListing[]>;
  openHelpRequests(): Promise<AssistantHelp[]>;
  openPolls(): Promise<AssistantPoll[]>;
  lostFound(): Promise<AssistantLostFound[]>;
}

export interface AnswerContext {
  lang: ReplyLanguage;
  neighborhoodName: { ar: string; en: string };
  now: Date;
  source: AssistantDataSource;
}

const SPORTS = new Set(['football', 'padel', 'walking', 'sports']);
const FAMILY = new Set(['family', 'kids']);

function windowRange(window: TimeWindow, now: Date): [Date, Date] {
  const p = saudiParts(now);
  // Midnight Riyadh (UTC+3) of today, as a UTC instant.
  const startOfToday = new Date(Date.UTC(p.year, p.month, p.day) - 3 * 3600000);
  const day = 86400000;
  switch (window) {
    case 'today':
      return [now, new Date(startOfToday.getTime() + day)];
    case 'tonight':
      return [new Date(Math.max(now.getTime(), startOfToday.getTime() + 17 * 3600000)), new Date(startOfToday.getTime() + day + 3 * 3600000)];
    case 'tomorrow':
      return [new Date(startOfToday.getTime() + day), new Date(startOfToday.getTime() + 2 * day)];
    case 'week':
      return [now, new Date(startOfToday.getTime() + 7 * day)];
    case 'weekend': {
      // Saudi weekend: Friday + Saturday (Thursday evening counts in practice).
      const daysUntilThu = (4 - p.weekday + 7) % 7;
      const thu = startOfToday.getTime() + daysUntilThu * day;
      return [new Date(Math.max(now.getTime(), thu + 16 * 3600000)), new Date(thu + 3 * day)];
    }
    default:
      return [now, new Date(startOfToday.getTime() + 30 * day)];
  }
}

function windowPhrase(window: TimeWindow, lang: ReplyLanguage): string {
  const ar: Record<TimeWindow, string> = {
    today: 'اليوم',
    tonight: 'الليلة',
    tomorrow: 'بكرة',
    week: 'هالأسبوع',
    weekend: 'في نهاية الأسبوع',
    upcoming: 'في الأيام الجاية',
  };
  const en: Record<TimeWindow, string> = {
    today: 'today',
    tonight: 'tonight',
    tomorrow: 'tomorrow',
    week: 'this week',
    weekend: 'this weekend',
    upcoming: 'coming up',
  };
  return lang === 'ar' ? ar[window] : en[window];
}

function n(value: number, lang: ReplyLanguage) {
  return localizeDigits(value, lang);
}

function when(iso: string, now: Date, lang: ReplyLanguage) {
  const time = formatClock(iso, lang);
  if (isSameSaudiDay(iso, now)) return lang === 'ar' ? `اليوم الساعة ${time}` : `today at ${time}`;
  const tomorrow = new Date(now.getTime() + 86400000);
  if (isSameSaudiDay(iso, tomorrow)) return lang === 'ar' ? `بكرة الساعة ${time}` : `tomorrow at ${time}`;
  const wd = weekdayName(saudiParts(iso).weekday, lang);
  return lang === 'ar' ? `يوم ${wd} ${formatShortDate(iso, lang)} الساعة ${time}` : `${wd}, ${formatShortDate(iso, lang)} at ${time}`;
}

function listJoin(items: string[], lang: ReplyLanguage) {
  if (items.length <= 1) return items.join('');
  return lang === 'ar' ? items.join('، ') : items.join('; ');
}

function describeEvent(e: AssistantEvent, now: Date, lang: ReplyLanguage) {
  const spots = Math.max(0, e.capacity - e.going);
  if (lang === 'ar') {
    const fill = spots === 0 ? 'مكتملة' : `${n(e.going, 'ar')} مشارك و${n(spots, 'ar')} مكان متاح`;
    return `«${e.title}» ${when(e.startsAt, now, 'ar')} في ${e.locationLabel} (${fill})`;
  }
  const fill = spots === 0 ? 'full' : `${e.going} going, ${spots} spot${spots === 1 ? '' : 's'} left`;
  return `"${e.title}" ${when(e.startsAt, now, 'en')} at ${e.locationLabel} (${fill})`;
}

const ISSUE_LABEL: Record<Exclude<IssueFocus, null>, { ar: string; en: string }> = {
  water: { ar: 'مياه', en: 'water' },
  electricity: { ar: 'كهرباء', en: 'electricity' },
  streetlight: { ar: 'إنارة', en: 'street lighting' },
  road_damage: { ar: 'طرق وحفريات', en: 'road damage' },
  trash: { ar: 'نظافة', en: 'trash' },
  flooding: { ar: 'سيول وتجمع مياه', en: 'flooding' },
  safety: { ar: 'سلامة', en: 'safety' },
};

const BUSINESS_LABEL: Record<Exclude<BusinessFocus, null>, { ar: string; en: string }> = {
  ac_repair: { ar: 'صيانة المكيفات', en: 'AC repair' },
  electrician: { ar: 'كهربائي', en: 'electrician' },
  plumber: { ar: 'سباك', en: 'plumber' },
  cafe: { ar: 'كافيه', en: 'café' },
  restaurant: { ar: 'مطعم', en: 'restaurant' },
  barber: { ar: 'حلاق', en: 'barber' },
  cleaning: { ar: 'تنظيف', en: 'cleaning' },
  tutor: { ar: 'مدرس خصوصي', en: 'tutor' },
  car_wash: { ar: 'غسيل سيارات', en: 'car wash' },
};

const UNAVAILABLE = {
  ar: 'ما قدرت أوصل لبيانات الحي الحين، فما أقدر أأكد لك. تأكد من الاتصال وجرب مرة ثانية.',
  en: "I couldn't reach your neighborhood's data just now, so I can't confirm that. Check your connection and try again.",
};

/** Composes a grounded answer. Throws nothing; data failures produce an honest "couldn't check" reply. */
export async function composeAnswer(q: ParsedQuestion, ctx: AnswerContext): Promise<string> {
  const { lang, now, source } = ctx;
  const hood = lang === 'ar' ? ctx.neighborhoodName.ar : ctx.neighborhoodName.en;
  try {
    switch (q.topic) {
      case 'greeting':
        return lang === 'ar'
          ? `هلا والله! أنا مساعد ${hood}. اسألني عن الفعاليات، البلاغات، التوصيات، أو الحراج في الحي.`
          : `Hi! I'm the ${hood} assistant. Ask me about events, activities, reported issues, recommendations, or listings in your neighborhood.`;

      case 'capabilities':
        return lang === 'ar'
          ? 'أقدر أشيّك لك على فعاليات وأنشطة الحي، البلاغات المفتوحة، توصيات الجيران للمحلات والخدمات، الحراج، طلبات المساعدة، التصويتات، والمفقودات — كلها من بيانات حيّك الفعلية.'
          : "I can check your neighborhood's events and activities, open issue reports, neighbors' business recommendations, marketplace listings, help requests, polls, and lost & found — all from your neighborhood's actual data.";

      case 'events':
      case 'sports':
      case 'family': {
        const [from, to] = windowRange(q.window, now);
        const all = (await source.events(from.toISOString(), to.toISOString())).filter((e) => !e.cancelled);
        const filtered = q.topic === 'sports' ? all.filter((e) => SPORTS.has(e.category)) : q.topic === 'family' ? all.filter((e) => FAMILY.has(e.category)) : all;
        const period = windowPhrase(q.window, lang);
        if (filtered.length === 0) {
          if (lang === 'ar') {
            const what = q.topic === 'sports' ? 'مباريات أو أنشطة رياضية' : q.topic === 'family' ? 'فعاليات عائلية' : 'فعاليات';
            return `حالياً ما فيه ${what} مسجلة في ${hood} ${period}. تقدر تنظّم وحدة من زر «إنشاء».`;
          }
          const what = q.topic === 'sports' ? 'sports games or activities' : q.topic === 'family' ? 'family events' : 'activities or events';
          return `There are currently no ${what} listed in ${hood} ${period}. You can organize one from the Create button.`;
        }
        const top = filtered.slice(0, 3).map((e) => describeEvent(e, now, lang));
        const more = filtered.length - top.length;
        if (lang === 'ar') {
          const head = filtered.length === 1 ? `فيه فعالية وحدة ${period}:` : `فيه ${n(filtered.length, 'ar')} فعاليات ${period}:`;
          return `${head} ${listJoin(top, 'ar')}.${more > 0 ? ` وفيه ${n(more, 'ar')} غيرها في صفحة الأنشطة.` : ''}`;
        }
        const head = filtered.length === 1 ? `There's 1 listed ${period}:` : `There are ${filtered.length} listed ${period}:`;
        return `${head} ${listJoin(top, 'en')}.${more > 0 ? ` ${more} more on the Activities page.` : ''}`;
      }

      case 'issues': {
        const all = await source.openIssues();
        const focus = q.issueFocus;
        const list = focus ? all.filter((i) => i.category === focus) : all;
        const label = focus ? ISSUE_LABEL[focus][lang] : null;
        if (list.length === 0) {
          if (lang === 'ar') return label ? `ما فيه بلاغات ${label} مفتوحة في ${hood} حالياً.` : `ما فيه بلاغات مفتوحة في ${hood} حالياً.`;
          return label ? `There are no open ${label} reports in ${hood} right now.` : `There are no open issue reports in ${hood} right now.`;
        }
        const latest = list[0];
        if (lang === 'ar') {
          return `فيه ${n(list.length, 'ar')} ${label ? `بلاغ ${label}` : 'بلاغ'} مفتوح. آخرها: «${latest.title}» (${formatShortDate(latest.createdAt, 'ar')}).`;
        }
        return `There ${list.length === 1 ? 'is 1 open' : `are ${list.length} open`} ${label ? `${label} ` : ''}report${list.length === 1 ? '' : 's'}. Most recent: "${latest.title}" (${formatShortDate(latest.createdAt, 'en')}).`;
      }

      case 'businesses': {
        const all = await source.businesses();
        const focus = q.businessFocus;
        const list = (focus ? all.filter((b) => b.category === focus) : all).sort((a, b) => b.recommendations - a.recommendations);
        const label = focus ? BUSINESS_LABEL[focus][lang] : null;
        if (list.length === 0) {
          return lang === 'ar'
            ? `ما لقيت ${label ? `توصيات لـ${label}` : 'محلات أو خدمات موصى فيها'} في ${hood} لحد الحين. تقدر تسأل الجيران بمنشور.`
            : `I didn't find any ${label ? `${label} recommendations` : 'recommended businesses or services'} in ${hood} yet. You could ask your neighbors in a post.`;
        }
        const top = list.slice(0, 3).map((b) =>
          lang === 'ar' ? `«${b.name}» (${n(b.recommendations, 'ar')} توصية)` : `"${b.name}" (${b.recommendations} recommendation${b.recommendations === 1 ? '' : 's'})`,
        );
        return lang === 'ar' ? `الأكثر توصية من الجيران: ${listJoin(top, 'ar')}.` : `Most recommended by neighbors: ${listJoin(top, 'en')}.`;
      }

      case 'marketplace': {
        const list = await source.listings();
        if (list.length === 0) return lang === 'ar' ? `ما فيه إعلانات في حراج ${hood} حالياً.` : `There are no marketplace listings in ${hood} right now.`;
        const free = list.filter((l) => l.listingType === 'free').length;
        return lang === 'ar'
          ? `فيه ${n(list.length, 'ar')} إعلان متاح في حراج الحي${free ? `، منها ${n(free, 'ar')} ببلاش` : ''}. أحدثها: «${list[0].title}».`
          : `There ${list.length === 1 ? 'is 1 listing' : `are ${list.length} listings`} available in the neighborhood marketplace${free ? ` (${free} free)` : ''}. Newest: "${list[0].title}".`;
      }

      case 'help': {
        const list = await source.openHelpRequests();
        if (list.length === 0) return lang === 'ar' ? 'ما فيه طلبات مساعدة مفتوحة من الجيران حالياً.' : 'There are no open help requests from neighbors right now.';
        return lang === 'ar'
          ? `فيه ${n(list.length, 'ar')} طلب مساعدة مفتوح. آخرها: «${list[0].title}».`
          : `There ${list.length === 1 ? 'is 1 open help request' : `are ${list.length} open help requests`}. Latest: "${list[0].title}".`;
      }

      case 'polls': {
        const list = await source.openPolls();
        if (list.length === 0) return lang === 'ar' ? 'ما فيه تصويتات مفتوحة في الحي حالياً.' : 'There are no open polls in the neighborhood right now.';
        const p = list[0];
        return lang === 'ar'
          ? `فيه ${n(list.length, 'ar')} تصويت مفتوح. آخرها: «${p.question}» (${n(p.totalVotes, 'ar')} صوت حتى الآن).`
          : `There ${list.length === 1 ? 'is 1 open poll' : `are ${list.length} open polls`}. Latest: "${p.question}" (${p.totalVotes} vote${p.totalVotes === 1 ? '' : 's'} so far).`;
      }

      case 'lostFound': {
        const list = (await source.lostFound()).filter((l) => l.status !== 'reunited');
        if (list.length === 0) return lang === 'ar' ? 'ما فيه بلاغات مفقودات مفتوحة في الحي حالياً.' : 'There are no open lost & found posts in the neighborhood right now.';
        const lost = list.filter((l) => l.status === 'lost').length;
        return lang === 'ar'
          ? `فيه ${n(list.length, 'ar')} منشور مفقودات (${n(lost, 'ar')} مفقود). آخرها: «${list[0].title}».`
          : `There ${list.length === 1 ? 'is 1 lost & found post' : `are ${list.length} lost & found posts`} (${lost} still lost). Latest: "${list[0].title}".`;
      }

      case 'summary':
      default: {
        const [from, to] = windowRange(q.window === 'upcoming' ? 'today' : q.window, now);
        const [events, issues, help] = await Promise.all([source.events(from.toISOString(), to.toISOString()), source.openIssues(), source.openHelpRequests()]);
        const active = events.filter((e) => !e.cancelled);
        const period = windowPhrase(q.window === 'upcoming' ? 'today' : q.window, lang);
        if (active.length === 0 && issues.length === 0 && help.length === 0) {
          return lang === 'ar'
            ? `حالياً ما فيه فعاليات أو بلاغات أو طلبات مساعدة مسجلة في ${hood} ${period}.`
            : `There's currently nothing listed in ${hood} ${period} — no activities, open issue reports, or help requests.`;
        }
        if (lang === 'ar') {
          const parts = [`${n(active.length, 'ar')} فعالية ${period}`, `${n(issues.length, 'ar')} بلاغ مفتوح`, `${n(help.length, 'ar')} طلب مساعدة`];
          const next = active[0] ? ` أقربها: ${describeEvent(active[0], now, 'ar')}.` : '';
          return `في ${hood}: ${parts.join('، ')}.${next}`;
        }
        const parts = [`${active.length} event${active.length === 1 ? '' : 's'} ${period}`, `${issues.length} open issue report${issues.length === 1 ? '' : 's'}`, `${help.length} help request${help.length === 1 ? '' : 's'}`];
        const next = active[0] ? ` Next up: ${describeEvent(active[0], now, 'en')}.` : '';
        return `In ${hood}: ${parts.join(', ')}.${next}`;
      }
    }
  } catch {
    return UNAVAILABLE[lang];
  }
}

export const assistantMessages = {
  offline: {
    ar: 'يبدو إنك غير متصل بالإنترنت، فما أقدر أشيّك على بيانات الحي الحين. جرّب لما يرجع الاتصال.',
    en: "You seem to be offline, so I can't check your neighborhood's data right now. Try again once you're connected.",
  },
  notVerified: {
    ar: 'لازم توثّق إنك من سكان الحي قبل ما أقدر أوريك محتواه. وثّق موقعك من الإعدادات وبعدها اسألني.',
    en: "Neighborhood content is only visible to verified residents. Verify your location in Settings, then ask me again.",
  },
  noNeighborhood: {
    ar: 'اختر حيّك أولاً عشان أقدر أساعدك.',
    en: 'Choose your neighborhood first so I can help.',
  },
};
