import fs from 'fs';
import path from 'path';

// A static guard against re-introducing the "getSnapshot should be cached"
// / "Maximum update depth exceeded" crash class: a Zustand selector
// (`useStore((s) => ...)`) whose body constructs a brand-new
// array/object/Set/Map on every call is an unstable snapshot under
// useSyncExternalStore. This walks every `useStore((s) => ...)` call site
// in the app and flags any whose selector body still does that.
//
// This is a *secondary* guard, not the only protection — see
// src/__tests__/zustandSelectorStability.test.tsx for the functional
// regression tests that actually render components against the real store
// and assert no such warning/crash occurs.
//
// Deliberately not a single regex over the whole file: selector bodies
// span multiple lines and nest parens arbitrarily (e.g. inside .find()
// predicates), so this does real bracket-depth matching to (a) find each
// selector's exact body and (b) find the *top-level* (depth-0) method
// chain within that body, rather than pattern-matching text anywhere in
// it — `arr.filter(x).some(y)` is safe (returns a boolean) even though
// the substring `.filter(` appears in it; what matters is the outermost
// call actually returned by the selector.

const ROOT_DIRS = ['app', 'src'];
const SELECTOR_HEAD = 'useStore((s) =>';
const SKIP_DIR_NAMES = new Set(['__tests__', 'node_modules']);

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) return [];
      return collectSourceFiles(path.join(dir, entry.name));
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) return [path.join(dir, entry.name)];
    return [];
  });
}

/** Given the index of `useStore((s) =>`, returns the selector's full body
 * text (from just after `=>` to its matching closing `)` of the outer
 * `useStore(...)` call), by counting paren depth character-by-character. */
function extractSelectorBody(source: string, headIndex: number): string {
  const bodyStart = headIndex + SELECTOR_HEAD.length;
  let depth = 1; // already inside the outer useStore( ... )
  let i = bodyStart;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') depth--;
  }
  return source.slice(bodyStart, i - 1);
}

/** Splits a selector body into its top-level (paren/bracket/brace-depth-0)
 * dot-chain segments, e.g. `s.a.b(x).c(y)` -> ['s', 'a', 'b(x)', 'c(y)']. */
function topLevelDotSegments(body: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === '.' && depth === 0) {
      segments.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  segments.push(current);
  return segments.map((s) => s.trim());
}

const UNSTABLE_LAST_SEGMENT = /^(filter|map|sort|slice|flatMap)\(/;
const STABLE_LAST_SEGMENT = /^(find|some|every)\(|^length\b/;

/** True if this selector body's *result* is a freshly-created reference
 * every call — a real match against the getSnapshot-instability class. */
function isUnstableSelectorBody(body: string): boolean {
  const trimmed = body.trim();

  // Bare array/object construction, or an unguarded `?? []` / `?? {}`
  // fallback after a .find() — both hand back a new reference every call
  // regardless of the top-level chain shape.
  if (/^\[\s*\.\.\./.test(trimmed)) return true;
  if (/^\(\{/.test(trimmed)) return true;
  if (/\bnew (Set|Map)\(/.test(trimmed)) return true;
  if (/\?\?\s*(\[\]|\{\})/.test(trimmed)) return true;

  const segments = topLevelDotSegments(trimmed);
  const last = segments[segments.length - 1] ?? '';

  if (STABLE_LAST_SEGMENT.test(last)) return false;
  if (UNSTABLE_LAST_SEGMENT.test(last)) return true;

  return false;
}

describe('Zustand selector static guard (secondary to the functional tests)', () => {
  const files = ROOT_DIRS.flatMap((d) => collectSourceFiles(path.resolve(__dirname, '../..', d)));
  const violations: { file: string; body: string }[] = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    let searchFrom = 0;
    for (;;) {
      const idx = source.indexOf(SELECTOR_HEAD, searchFrom);
      if (idx === -1) break;
      const body = extractSelectorBody(source, idx);
      if (isUnstableSelectorBody(body)) {
        violations.push({ file: path.relative(path.resolve(__dirname, '../..'), file), body: body.trim().slice(0, 200) });
      }
      searchFrom = idx + SELECTOR_HEAD.length;
    }
  }

  it('scanned a non-trivial number of useStore selector call sites', () => {
    // Sanity check that the scan itself is actually finding selectors —
    // guards against this test silently doing nothing if the source
    // pattern (`useStore((s) =>`) ever changes.
    let total = 0;
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      total += source.split(SELECTOR_HEAD).length - 1;
    }
    expect(total).toBeGreaterThan(100);
  });

  it('has no useStore selector that constructs a fresh array/object/Set/Map on every call', () => {
    if (violations.length > 0) {
      const report = violations.map((v) => `  ${v.file}:\n    ${v.body}`).join('\n\n');
      throw new Error(
        `Found ${violations.length} unstable Zustand selector(s). Select raw state and derive with useMemo instead ` +
          `(see src/features/home/HomeHeader.tsx for the pattern):\n\n${report}`,
      );
    }
    expect(violations).toEqual([]);
  });
});
