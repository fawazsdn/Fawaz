import { composeAnswer, type AssistantDataSource } from '../engine';
import { parseQuestion } from '../intent';
import { detectReplyLanguage } from '../language';
import { ask } from '../index';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const NOW = new Date('2026-10-12T09:00:00Z'); // 12:00 PM Riyadh, Monday

function source(overrides: Partial<AssistantDataSource> = {}): AssistantDataSource {
  return {
    events: async () => [],
    openIssues: async () => [],
    businesses: async () => [],
    listings: async () => [],
    openHelpRequests: async () => [],
    openPolls: async () => [],
    lostFound: async () => [],
    ...overrides,
  };
}

const ctxBase = {
  neighborhoodId: 'sa-district-10500227013',
  neighborhoodName: { ar: 'أجيال', en: 'Ajyal' },
  verified: true,
  uiLocale: 'ar' as const,
  now: NOW,
  checkOnline: async () => true,
};

describe('detectReplyLanguage', () => {
  it('replies in English to an English question even when the UI is Arabic', () => {
    expect(detectReplyLanguage("What's happening in my neighborhood today?", 'ar')).toBe('en');
  });
  it('replies in Arabic to an Arabic (Saudi dialect) question even when the UI is English', () => {
    expect(detectReplyLanguage('وش فيه فعاليات اليوم في الحي؟', 'en')).toBe('ar');
  });
  it('uses the dominant script for mixed messages', () => {
    expect(detectReplyLanguage('فيه football اليوم في الحي؟', 'en')).toBe('ar');
    expect(detectReplyLanguage('Is there a كورة match tonight near me?', 'ar')).toBe('en');
  });
  it('falls back to the previous turn when the message has no letters', () => {
    expect(detectReplyLanguage('؟؟ 👍', 'en')).toBe('en');
    expect(detectReplyLanguage('7', 'ar')).toBe('ar');
  });
});

describe('parseQuestion', () => {
  it.each([
    ["What's happening in my neighborhood today?", 'events', 'today'],
    ['وش فيه فعاليات اليوم في الحي؟', 'events', 'today'],
    ['فيه كورة الليلة؟', 'sports', 'tonight'],
    ['Any padel games this weekend?', 'sports', 'weekend'],
    ['فيه فعاليات للبزران هالأسبوع؟', 'family', 'week'],
    ['Any water issues right now?', 'issues', 'today'],
    ['فيه انقطاع موية؟', 'issues', 'upcoming'],
    ['أبي توصية فني مكيفات', 'businesses', 'upcoming'],
    ['Who lost a cat?', 'lostFound', 'upcoming'],
    ['hello', 'greeting', 'upcoming'],
  ])('%s → %s/%s', (q, topic, window) => {
    const p = parseQuestion(q);
    expect(p.topic).toBe(topic);
    expect(p.window).toBe(window);
  });
});

describe('composeAnswer (grounded, no invention)', () => {
  it('matches the requested English empty-state answer', async () => {
    const text = await composeAnswer(parseQuestion("What's happening in my neighborhood today?"), { lang: 'en', neighborhoodName: ctxBase.neighborhoodName, now: NOW, source: source() });
    expect(text).toMatch(/^There are currently no activities or events listed in Ajyal today/);
  });

  it('matches the requested Arabic empty-state answer', async () => {
    const text = await composeAnswer(parseQuestion('وش فيه فعاليات اليوم في الحي؟'), { lang: 'ar', neighborhoodName: ctxBase.neighborhoodName, now: NOW, source: source() });
    expect(text).toMatch(/^حالياً ما فيه فعاليات مسجلة في أجيال اليوم/);
  });

  it('lists only real events with real counts and 12-hour Saudi times', async () => {
    const src = source({
      events: async () => [
        { title: 'Neighborhood football', kind: 'activity', category: 'football', startsAt: '2026-10-12T16:00:00Z', locationLabel: 'Ajyal park', going: 7, capacity: 10, cancelled: false },
      ],
    });
    const en = await composeAnswer(parseQuestion('Any football today?'), { lang: 'en', neighborhoodName: ctxBase.neighborhoodName, now: NOW, source: src });
    expect(en).toContain('"Neighborhood football" today at 7:00 PM at Ajyal park (7 going, 3 spots left)');
    const ar = await composeAnswer(parseQuestion('فيه كورة اليوم؟'), { lang: 'ar', neighborhoodName: ctxBase.neighborhoodName, now: NOW, source: src });
    expect(ar).toContain('اليوم الساعة ٧:٠٠ م');
    expect(ar).toContain('٧ مشارك و٣ مكان متاح');
  });

  it('ignores cancelled events', async () => {
    const src = source({
      events: async () => [{ title: 'Cancelled walk', kind: 'activity', category: 'walking', startsAt: '2026-10-12T15:00:00Z', locationLabel: 'x', going: 1, capacity: 5, cancelled: true }],
    });
    const text = await composeAnswer(parseQuestion('What activities are there today?'), { lang: 'en', neighborhoodName: ctxBase.neighborhoodName, now: NOW, source: src });
    expect(text).not.toContain('Cancelled walk');
    expect(text).toMatch(/no activities or events/);
  });

  it('says it could not check (never "nothing") when data retrieval fails', async () => {
    const src = source({ events: async () => Promise.reject(new Error('network')) });
    const text = await composeAnswer(parseQuestion('What is happening today?'), { lang: 'en', neighborhoodName: ctxBase.neighborhoodName, now: NOW, source: src });
    expect(text).toMatch(/couldn't reach/);
    expect(text).not.toMatch(/no activities/);
  });
});

describe('ask', () => {
  it('answers English questions in English with an Arabic UI', async () => {
    const res = await ask("What's happening in my neighborhood today?", { ...ctxBase, uiLocale: 'ar', source: source() });
    expect(res.lang).toBe('en');
    expect(res.text).toMatch(/^There are currently no/);
  });

  it('answers Arabic questions in Arabic with an English UI', async () => {
    const res = await ask('وش فيه فعاليات اليوم في الحي؟', { ...ctxBase, uiLocale: 'en', source: source() });
    expect(res.lang).toBe('ar');
    expect(res.text).toMatch(/^حالياً ما فيه فعاليات/);
  });

  it('handles offline gracefully, in the question language', async () => {
    const res = await ask('Any events today?', { ...ctxBase, checkOnline: async () => false, source: source() });
    expect(res.text).toMatch(/offline/);
  });

  it('does not reveal neighborhood content to unverified residents', async () => {
    const events = jest.fn(async () => []);
    const res = await ask('وش فيه اليوم؟', { ...ctxBase, verified: false, source: source({ events }) });
    expect(res.text).toMatch(/توثّق/);
    expect(events).not.toHaveBeenCalled();
  });
});
