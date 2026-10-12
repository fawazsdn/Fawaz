export type ReplyLanguage = 'ar' | 'en';

// Arabic LETTERS only — not Arabic punctuation (، ؛ ؟), Arabic-Indic digits
// or diacritics, so "؟؟ 👍" or "٧" count as letterless.
const ARABIC_LETTER = /[\u0621-\u063A\u0641-\u064A\u0671-\u06D3\u06D5\u06EE\u06EF\u06FA-\u06FC\u06FF\u0750-\u077F\u08A0-\u08C9\uFB50-\uFDFB\uFE70-\uFEFC]/g;
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
