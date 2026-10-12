import { normalizeForSearch } from '@/utils/searchNormalize';

export type AssistantTopic =
  | 'greeting'
  | 'events'
  | 'sports'
  | 'family'
  | 'issues'
  | 'businesses'
  | 'marketplace'
  | 'help'
  | 'polls'
  | 'lostFound'
  | 'capabilities'
  | 'summary';

export type TimeWindow = 'today' | 'tonight' | 'tomorrow' | 'week' | 'weekend' | 'upcoming';

export type IssueFocus = 'water' | 'electricity' | 'streetlight' | 'road_damage' | 'trash' | 'flooding' | 'safety' | null;
export type BusinessFocus =
  'ac_repair' | 'electrician' | 'plumber' | 'cafe' | 'restaurant' | 'barber' | 'cleaning' | 'tutor' | 'car_wash' | null;

export interface ParsedQuestion {
  topic: AssistantTopic;
  window: TimeWindow;
  issueFocus: IssueFocus;
  businessFocus: BusinessFocus;
}

// Patterns run against normalizeForSearch() output (lower-case, alef/taa
// marbuta/yaa variants unified), so "فعاليه"/"فعالية" and "أنشطة"/"انشطه"
// match alike. Saudi/Gulf dialect forms are included (وش، ايش، كوره، بزران…).
const P = {
  greeting: /^(hi|hello|hey|salam|السلام|مرحبا|هلا|اهلا|صباح|مساء)\b/,
  capabilities: /(what can you (do|help)|who are you|help me use|وش تقدر|ايش تقدر|شو تقدر|مين انت|كيف استخدم)/,
  sports: /(football|soccer|padel|match|game|sport|walk|run|كوره|كرة|كره|مباره|مباراه|ماتش|بادل|رياض|مشي|جري|دوري|بطوله)/,
  family: /(family|kid|child|children|families|عائل|عايل|اطفال|طفل|بزران|عيال|اسر)/,
  events:
    /(event|activit|happening|going on|plan|gathering|meetup|festival|iftar|eid|national day|فعالي|فعاليه|نشاط|انشطه|ايش فيه|وش فيه|شو فيه|وش في|ايش في|وش صاير|ايش صاير|تجمع|لقاء|افطار|عيد|اليوم الوطني|مهرجان|سهره)/,
  issues:
    /(issue|problem|outage|cut|leak|broken|report|water|power|electric|light|pothole|trash|garbage|flood|بلاغ|مشكل|مشاكل|انقطاع|قطع|تسرب|موي|ميا|ماء|كهرب|انار|اناره|حفر|حفره|زبال|نفايات|مطر|سيول|غرق)/,
  businesses:
    /(recommend|plumber|electrician|\bac\b|air ?con|repair|cafe|coffee|restaurant|barber|cleaning|tutor|car wash|shop|business|service|توصي|انصح|تنصح|سباك|كهربائي|فني|مكيف|مكيفات|تكييف|مطعم|كافيه|كوفي|قهوه|حلاق|تنظيف|مدرس|غسيل|محل|خدم)/,
  marketplace: /(sell|selling|buy|for sale|marketplace|second ?hand|free stuff|listing|حراج|بيع|للبيع|شراء|اشتري|سوق|مستعمل|ببلاش|مجان)/,
  help: /(help request|need help|anyone help|volunteer|طلب مساعده|طلبات|مساعده|فزعه|فزعة|يساعد|محتاج)/,
  polls: /(poll|vote|survey|تصويت|استفتاء|استطلاع|صوت)/,
  lostFound: /(lost|found|missing|pet|cat|dog|wallet|key|مفقود|ضايع|ضاع|ضايعه|لقيت|قطه|قطو|كلب|محفظه|مفتاح)/,
};

const W = {
  tonight: /(tonight|this evening|الليله|الليلة|هالليله|المسا|المساء)/,
  tomorrow: /(tomorrow|بكره|بكرة|غدا|غداً|باچر|باكر)/,
  weekend: /(weekend|الويكند|نهايه الاسبوع|الخميس|الجمعه|السبت)/,
  week: /(this week|week|هالاسبوع|هذا الاسبوع|الاسبوع)/,
  today: /(today|now|right now|currently|اليوم|الحين|الحين|هالحين|حاليا|الان)/,
};

const ISSUE_FOCUS: [RegExp, Exclude<IssueFocus, null>][] = [
  [/(water|leak|موي|ميا|ماء|تسرب)/, 'water'],
  [/(power|electric|outage|كهرب|انقطاع الكهرب)/, 'electricity'],
  [/(street ?light|lamp|انار|اناره|عمود)/, 'streetlight'],
  [/(pothole|road|حفر|حفره|طريق|شارع)/, 'road_damage'],
  [/(trash|garbage|زبال|نفايات)/, 'trash'],
  [/(flood|rain|سيول|غرق|مطر)/, 'flooding'],
  [/(safety|danger|امن|خطر)/, 'safety'],
];

const BUSINESS_FOCUS: [RegExp, Exclude<BusinessFocus, null>][] = [
  [/(\bac\b|air ?con|مكيف|مكيفات|تكييف)/, 'ac_repair'],
  [/(electrician|كهربائي)/, 'electrician'],
  [/(plumb|سباك)/, 'plumber'],
  [/(cafe|coffee|كافيه|كوفي|قهوه)/, 'cafe'],
  [/(restaurant|food|مطعم|اكل)/, 'restaurant'],
  [/(barber|حلاق)/, 'barber'],
  [/(clean|تنظيف)/, 'cleaning'],
  [/(tutor|teacher|مدرس)/, 'tutor'],
  [/(car wash|غسيل)/, 'car_wash'],
];

export function parseQuestion(raw: string): ParsedQuestion {
  const q = normalizeForSearch(raw);

  let window: TimeWindow = 'upcoming';
  if (W.tonight.test(q)) window = 'tonight';
  else if (W.tomorrow.test(q)) window = 'tomorrow';
  else if (W.weekend.test(q)) window = 'weekend';
  else if (W.week.test(q)) window = 'week';
  else if (W.today.test(q)) window = 'today';

  const issueFocus = ISSUE_FOCUS.find(([re]) => re.test(q))?.[1] ?? null;
  const businessFocus = BUSINESS_FOCUS.find(([re]) => re.test(q))?.[1] ?? null;

  // Order matters: more specific topics win over the generic "events" one.
  let topic: AssistantTopic = 'summary';
  if (P.capabilities.test(q)) topic = 'capabilities';
  else if (P.lostFound.test(q)) topic = 'lostFound';
  else if (P.polls.test(q)) topic = 'polls';
  else if (P.businesses.test(q) && businessFocus) topic = 'businesses';
  else if (P.issues.test(q) && (issueFocus || /(issue|problem|report|بلاغ|مشكل|مشاكل)/.test(q))) topic = 'issues';
  else if (P.sports.test(q)) topic = 'sports';
  else if (P.family.test(q)) topic = 'family';
  else if (P.events.test(q)) topic = 'events';
  else if (P.marketplace.test(q)) topic = 'marketplace';
  else if (P.help.test(q)) topic = 'help';
  else if (P.businesses.test(q)) topic = 'businesses';
  else if (P.issues.test(q)) topic = 'issues';
  else if (P.greeting.test(q) && q.split(' ').length <= 4) topic = 'greeting';

  return { topic, window, issueFocus, businessFocus };
}
