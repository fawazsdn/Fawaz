/**
 * Search-only text normalization for Arabic + English place names.
 *
 * This NEVER touches what gets displayed — only what gets compared during
 * search — so official names from the geography dataset are shown exactly
 * as sourced, while still matching common spelling variants a resident
 * might type (أ/إ/آ vs ا, ة vs ه, ى vs ي, "Al-Aqrabiyah" vs "Al Aqrabiyah").
 */
export function normalizeForSearch(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKC')
    // Arabic alef variants -> bare alef
    .replace(/[أإآا]/g, 'ا')
    // taa marbuta -> haa (common informal-writing equivalence)
    .replace(/ة/g, 'ه')
    // alef maksura -> yaa
    .replace(/ى/g, 'ي')
    // strip Arabic diacritics (tashkeel), if any slip in
    .replace(/[ؗ-ًؚ-ْ]/g, '')
    // hyphens/underscores/periods -> space, so "Al-Aqrabiyah" ~ "Al Aqrabiyah"
    .replace(/[-_.]/g, ' ')
    // collapse and trim whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/** True if `haystack` contains `needle` after search normalization. */
export function searchMatches(haystack: string, needle: string): boolean {
  const n = normalizeForSearch(needle);
  if (!n) return false;
  return normalizeForSearch(haystack).includes(n);
}
