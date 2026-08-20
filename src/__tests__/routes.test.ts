import fs from 'fs';
import path from 'path';

// A lightweight substitute for mounting a full navigator in tests: walks
// every screen file under app/ and checks it exports a default component.
// This catches the most common way a route silently breaks navigation —
// a typo'd export or an accidentally-empty file — without needing to boot
// native modules for every screen (image pickers, maps, etc.) in Jest.

const APP_DIR = path.resolve(__dirname, '../../app');

function collectRouteFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectRouteFiles(full);
    if (entry.name.endsWith('.tsx') && !entry.name.startsWith('_')) return [full];
    return [];
  });
}

describe('app routes', () => {
  const files = collectRouteFiles(APP_DIR);

  it('finds every expected top-level route file', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it.each(files)('%s exports a default component', (file) => {
    const source = fs.readFileSync(file, 'utf8');
    expect(source).toMatch(/export default function \w+/);
  });
});
