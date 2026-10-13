// Frames real iPhone captures from raw/ with the AR/EN captions.
//   node docs/app-store/screenshots/compose.mjs
// Input:  raw/<id>-ar.png and raw/<id>-en.png (captured on a device/simulator)
// Output: out/6.9/<id>-<lang>.png (1320x2868) and out/6.5/<id>-<lang>.png (1284x2778)
// Missing captures are skipped and listed, never faked.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const captions = JSON.parse(readFileSync(join(here, 'captions.json'), 'utf8'));
const sizes = { 6.9: [1320, 2868], 6.5: [1284, 2778] };
const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const missing = [];
for (const c of captions) {
  for (const lang of ['ar', 'en']) {
    const shot = join(here, 'raw', `${c.id}-${lang}.png`);
    if (!existsSync(shot)) {
      missing.push(`raw/${c.id}-${lang}.png`);
      continue;
    }
    for (const [size, [w, h]] of Object.entries(sizes)) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const url = new URL(pathToFileURL(join(here, 'template.html')));
      for (const [k, v] of Object.entries({ w, h, lang, caption: c[lang], shot: pathToFileURL(shot).href }))
        url.searchParams.set(k, String(v));
      await page.goto(url.href);
      await page.waitForFunction(() => document.getElementById('s').complete);
      mkdirSync(join(here, 'out', size), { recursive: true });
      await page.screenshot({ path: join(here, 'out', size, `${c.id}-${lang}.png`) });
      await page.close();
    }
  }
}
await browser.close();
console.log(missing.length ? `Skipped ${missing.length} missing captures:\n  ${missing.join('\n  ')}` : 'All 12 screenshots composed.');
