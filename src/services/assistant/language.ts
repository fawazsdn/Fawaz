export type ReplyLanguage = 'ar' | 'en';

const ARABIC_LETTER = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
const LATIN_LETTER = /[A-Za-z]/g;

/**
 * Detects the language to reply in from the user's LATEST message only —
 * independent of the app's UI language and of the neighborhood's country.
 *
 * Counts Arabic-script vs Latin letters (digits, punctuation, emoji and
 * whitespace are ignored), so mixed messages ("فيه football اليوم؟") are
 * answered in whichever script dominates. On an exact tie, or a message with
 * no letters at all ("?", "👍", "7"), we keep the language of the previous
 * turn, falling back to the UI locale only when there is no previous turn.
 */
export function detectReplyLanguage(message: string, fallback: ReplyLanguage): ReplyLanguage {
  const arabic = (message.match(ARABIC_LETTER) ?? []).length;
  const latin = (message.match(LATIN_LETTER) ?? []).length;
  if (arabic > latin) return 'ar';
  if (latin > arabic) return 'en';
  return fallback;
}
