// Copies the shared legal content from the app into the
// website, so the app's in-app legal pages and the website never disagree.
// The copies are committed too: if the app folder is not available (for
// example a deployment that only uploads web/), the committed copies are used.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(web, '..');
const pairs = [
  ['src/content/legal.json', 'src/content/shared/legal.json'],
  ['src/content/legal-config.json', 'src/content/shared/legal-config.json'],
];

mkdirSync(join(web, 'src/content/shared'), { recursive: true });
let copied = 0;
for (const [from, to] of pairs) {
  const src = join(repo, from);
  if (!existsSync(src)) continue;
  const dest = join(web, to);
  const next = readFileSync(src, 'utf8');
  if (!existsSync(dest) || readFileSync(dest, 'utf8') !== next) writeFileSync(dest, next);
  copied++;
}
console.log(copied ? `sync-content: ${copied} files from the app` : 'sync-content: app folder not found, using committed copies');
