import * as Network from 'expo-network';

import { supabase } from '@/lib/supabase';
import { assistantMessages, composeAnswer, type AssistantDataSource } from './engine';
import { parseQuestion } from './intent';
import { detectReplyLanguage, type ReplyLanguage } from './language';

export { detectReplyLanguage } from './language';
export { parseQuestion } from './intent';
export { composeAnswer } from './engine';
export type { ReplyLanguage } from './language';


function rows<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

/** Reads straight from Supabase as the signed-in resident — RLS limits it to their neighborhood. */
export function supabaseAssistantSource(neighborhoodId: string): AssistantDataSource {
  return {
    async events(fromIso, toIso) {
      const data = rows<any>(
        await supabase
          .from('events')
          .select('title, kind, category, starts_at, location_label, capacity, cancelled_at, event_attendees(status)')
          .eq('neighborhood_id', neighborhoodId)
          .is('deleted_at', null)
          .gte('starts_at', fromIso)
          .lt('starts_at', toIso)
          .order('starts_at', { ascending: true })
          .limit(50),
      );
      return data.map((e) => ({
        title: e.title,
        kind: e.kind,
        category: e.category,
        startsAt: e.starts_at,
        locationLabel: e.location_label,
        capacity: e.capacity,
        cancelled: !!e.cancelled_at,
        going: ((e.event_attendees ?? []) as { status: string }[]).filter((a) => a.status === 'going').length,
      }));
    },
    async openIssues() {
      const data = rows<any>(
        await supabase.from('issues').select('title, category, status, created_at').eq('neighborhood_id', neighborhoodId).neq('status', 'resolved').order('created_at', { ascending: false }).limit(50),
      );
      return data.map((i) => ({ title: i.title, category: i.category, status: i.status, createdAt: i.created_at }));
    },
    async businesses() {
      const data = rows<any>(
        await supabase
          .from('businesses')
          .select('name, category, business_neighborhoods!inner(neighborhood_id), business_recommendations(id, deleted_at)')
          .eq('business_neighborhoods.neighborhood_id', neighborhoodId)
          .limit(100),
      );
      return data.map((b) => ({
        name: b.name,
        category: b.category,
        recommendations: ((b.business_recommendations ?? []) as { deleted_at: string | null }[]).filter((r) => !r.deleted_at).length,
      }));
    },
    async listings() {
      const data = rows<any>(
        await supabase.from('marketplace_listings').select('title, listing_type, price').eq('neighborhood_id', neighborhoodId).eq('status', 'available').order('created_at', { ascending: false }).limit(50),
      );
      return data.map((l) => ({ title: l.title, listingType: l.listing_type, price: l.price ?? undefined }));
    },
    async openHelpRequests() {
      const data = rows<any>(
        await supabase.from('help_requests').select('title').eq('neighborhood_id', neighborhoodId).eq('status', 'open').order('created_at', { ascending: false }).limit(50),
      );
      return data.map((h) => ({ title: h.title }));
    },
    async openPolls() {
      const data = rows<any>(
        await supabase.from('polls').select('question, total_votes, closes_at').eq('neighborhood_id', neighborhoodId).gt('closes_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(20),
      );
      return data.map((p) => ({ question: p.question, totalVotes: p.total_votes ?? 0, closesAt: p.closes_at }));
    },
    async lostFound() {
      const data = rows<any>(
        await supabase.from('lost_found_posts').select('title, status, kind').eq('neighborhood_id', neighborhoodId).order('created_at', { ascending: false }).limit(50),
      );
      return data.map((l) => ({ title: l.title, status: l.status, kind: l.kind }));
    },
  };
}

export interface AskContext {
  neighborhoodId: string | null;
  neighborhoodName: { ar: string; en: string };
  verified: boolean;
  /** Language of the previous assistant reply (used only when the new message has no letters / an exact tie). */
  previousLanguage?: ReplyLanguage;
  uiLocale: ReplyLanguage;
  /** Injected in tests; defaults to live Supabase. */
  source?: AssistantDataSource;
  now?: Date;
  checkOnline?: () => Promise<boolean>;
}

async function defaultOnline() {
  try {
    const s = await Network.getNetworkStateAsync();
    return s.isConnected !== false && s.isInternetReachable !== false;
  } catch {
    return true;
  }
}

/**
 * The Neighborhood Assistant. Replies in the language of the user's latest
 * message (not the UI language, not the neighborhood's country) and only
 * from data it actually retrieved for this question.
 */
export async function ask(query: string, ctx: AskContext): Promise<{ text: string; lang: ReplyLanguage }> {
  const lang = detectReplyLanguage(query, ctx.previousLanguage ?? ctx.uiLocale);
  if (!ctx.neighborhoodId) return { text: assistantMessages.noNeighborhood[lang], lang };
  if (!(await (ctx.checkOnline ?? defaultOnline)())) return { text: assistantMessages.offline[lang], lang };
  const question = parseQuestion(query);
  if (!ctx.verified && question.topic !== 'greeting' && question.topic !== 'capabilities') {
    return { text: assistantMessages.notVerified[lang], lang };
  }
  const text = await composeAnswer(question, {
    lang,
    neighborhoodName: ctx.neighborhoodName,
    now: ctx.now ?? new Date(),
    source: ctx.source ?? supabaseAssistantSource(ctx.neighborhoodId),
  });
  return { text, lang };
}
