import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Production code (app/ and src/ outside tests) must never import test
 * fixtures or the old mock layer, and must not contain demo-only artifacts
 * that previously shipped (seeded data, simulated replies, stock images).
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'testing' || name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const root = join(__dirname, '..', '..');
const files = [...walk(join(root, 'app')), ...walk(join(root, 'src'))];

describe('production bundle contains no mock data', () => {
  it.each([
    ['test fixtures', /@\/testing\//],
    ['old mock seed', /mocks\/seed/],
    ['simulated incoming messages', /simulateIncoming|CANNED_REPLIES/],
    ['stock photos', /unsplash\.com|pravatar|picsum/],
    ['hardcoded demo coordinates', /DEMO_COORDS/],
    ['random fake distances', /approxDistanceM:\s*Math\.round\(.*Math\.random/],
  ])('no %s', (_label, pattern) => {
    const offenders = files.filter((f) => pattern.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
