import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGES = ['', '/support', '/faq', '/contact', '/privacy', '/terms', '/guidelines', '/delete-account'];
const LOCALES = [
  { code: 'ar', dir: 'rtl' },
  { code: 'en', dir: 'ltr' },
];

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(0);
}

test.describe('pages', () => {
  for (const { code, dir } of LOCALES) {
    for (const p of PAGES) {
      test(`${code}${p || '/'} renders with correct language and direction @mobile`, async ({ page }) => {
        const res = await page.goto(`/${code}${p}`);
        expect(res?.status()).toBe(200);
        await expect(page.locator('html')).toHaveAttribute('lang', code);
        await expect(page.locator('html')).toHaveAttribute('dir', dir);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page).toHaveTitle(/حارتنا|Haratna/);
        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
        expect(canonical).toMatch(new RegExp(`/${code}${p}$`));
        await expect(page.locator(`link[rel="alternate"][hreflang="${code === 'ar' ? 'en' : 'ar'}"]`)).toHaveCount(1);
        await noHorizontalScroll(page);
        // No unfinished copy on public pages.
        const text = await page.locator('body').innerText();
        expect(text).not.toMatch(/\{\{|lorem ipsum|TODO|TBD|placeholder/i);
      });
    }
  }

  test('home does not claim the app is on the App Store', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.getByText('قريباً على App Store')).toBeVisible();
    expect(await page.locator('a[href*="apps.apple.com"]').count()).toBe(0);
    await page.goto('/en');
    await expect(page.getByText('Coming soon to the App Store')).toBeVisible();
  });
});

test.describe('App Store Connect URLs', () => {
  for (const [from, to] of [
    ['/', '/ar'],
    ['/support', '/ar/support'],
    ['/privacy', '/ar/privacy'],
    ['/terms', '/ar/terms'],
    ['/delete-account', '/ar/delete-account'],
    ['/guidelines', '/ar/guidelines'],
    ['/contact', '/ar/contact'],
    ['/faq', '/ar/faq'],
  ]) {
    test(`${from} resolves to ${to}`, async ({ request }) => {
      const res = await request.get(from, { maxRedirects: 0 });
      expect([307, 308]).toContain(res.status());
      expect(res.headers()['location']).toBe(to);
      const final = await request.get(from);
      expect(final.status()).toBe(200);
    });
  }

  test('unknown paths return 404', async ({ request }) => {
    expect((await request.get('/en/does-not-exist')).status()).toBe(404);
    expect((await request.get('/fr')).status()).toBe(404);
  });
});

test.describe('navigation', () => {
  test('every internal link resolves', async ({ page, request }) => {
    const seen = new Set<string>();
    for (const { code } of LOCALES) {
      for (const p of PAGES) {
        await page.goto(`/${code}${p}`);
        for (const href of await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))) {
          const [path, hash] = href.split('#');
          const clean = path.split('?')[0];
          if (!seen.has(clean)) {
            seen.add(clean);
            const res = await request.get(clean);
            expect(res.status(), `broken link ${href} on /${code}${p}`).toBe(200);
          }
          if (hash && clean === new URL(page.url()).pathname) {
            expect(await page.locator(`[id="${hash}"]`).count(), `missing anchor #${hash} on ${clean}`).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(16);
  });

  test('language switch keeps the current page', async ({ page }) => {
    await page.goto('/ar/privacy');
    await page.getByRole('link', { name: 'Switch to English' }).click();
    await expect(page).toHaveURL(/\/en\/privacy$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.getByRole('link', { name: 'التبديل إلى العربية' }).click();
    await expect(page).toHaveURL(/\/ar\/privacy$/);
  });

  test('mobile menu opens, navigates and closes with Escape @mobile', async ({ page }) => {
    test.skip(page.viewportSize()!.width > 700, 'mobile only');
    await page.goto('/en');
    const button = page.getByRole('button', { name: 'Menu' });
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await page
      .locator('nav#' + (await button.getAttribute('aria-controls'))!.replace(/:/g, '\\:'))
      .getByRole('link', { name: 'Support' })
      .click();
    await expect(page).toHaveURL(/\/en\/support$/);
  });

  test('first Tab reaches the skip link, which moves focus to main content', async ({ page }) => {
    await page.goto('/ar/support');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'تخطَّ إلى المحتوى' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });
});

test.describe('support center', () => {
  test('FAQ search filters answers, including Arabic letter variants', async ({ page }) => {
    await page.goto('/ar/support');
    const search = page.getByLabel('ابحث في المساعدة');
    await search.fill('احذف حسابي');
    await expect(page.getByText('كيف أحذف حسابي؟')).toBeVisible();
    await expect(page.getByText('كيف أضيف جاراً؟')).toHaveCount(0);
    await search.fill('zzzz-no-match');
    await expect(page.getByRole('status').first()).toContainText('لا توجد نتائج');
    await page.goto('/en/support');
    await page.getByLabel('Search help').fill('block');
    await expect(page.getByText('How do I block someone?')).toBeVisible();
  });

  test('client-side validation blocks an empty or malformed submission', async ({ page }) => {
    let posted = false;
    page.on('request', (r) => {
      if (r.url().endsWith('/api/support')) posted = true;
    });
    await page.goto('/en/support');
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.locator('form').getByRole('alert')).toContainText('Please correct the highlighted fields.');
    await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
    await page.getByLabel('Email', { exact: true }).fill('not-an-email');
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText('Enter a valid email, like name@example.com')).toBeVisible();
    await expect(page.getByLabel('Topic', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    expect(posted).toBe(false);
  });

  test('?topic= preselects the topic (deletion page link)', async ({ page }) => {
    await page.goto('/en/delete-account');
    await page.getByRole('link', { name: 'Request account deletion' }).click();
    await expect(page).toHaveURL(/topic=deletion/);
    await expect(page.getByLabel('Topic', { exact: true })).toHaveValue('deletion');
  });
});

test.describe('support API hardening', () => {
  const valid = {
    name: '',
    email: 'qa@example.invalid',
    category: 'general',
    subject: 'Hello there',
    message: 'A sufficiently long test message body.',
    locale: 'en',
  };

  test('rejects cross-origin requests', async ({ request }) => {
    const res = await request.post('/api/support', {
      data: { ...valid, startedAt: Date.now() - 10_000 },
      headers: { Origin: 'https://evil.example' },
    });
    expect(res.status()).toBe(403);
  });

  test('rejects bots (honeypot), instant submissions and invalid fields', async ({ request, baseURL }) => {
    const headers = { Origin: baseURL! };
    expect(
      (await request.post('/api/support', { data: { ...valid, website: 'spam', startedAt: Date.now() - 10_000 }, headers })).status(),
    ).toBe(400);
    const fast = await request.post('/api/support', { data: { ...valid, startedAt: Date.now() }, headers });
    expect(fast.status()).toBe(400);
    expect((await fast.json()).error).toBe('too_fast');
    const bad = await request.post('/api/support', {
      data: { ...valid, email: 'x', category: 'billing', startedAt: Date.now() - 10_000 },
      headers,
    });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).fields).toEqual({ email: 'invalid', category: 'invalid' });
  });

  test('rejects oversized bodies, wrong content type and GET', async ({ request, baseURL }) => {
    const headers = { Origin: baseURL! };
    expect((await request.post('/api/support', { data: { ...valid, message: 'x'.repeat(20_000), startedAt: 1 }, headers })).status()).toBe(
      413,
    );
    expect(
      (
        await request.post('/api/support', { data: 'a=b', headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } })
      ).status(),
    ).toBe(415);
    expect((await request.get('/api/support')).status()).toBe(405);
  });
});

test.describe('security and SEO', () => {
  test('security headers are set', async ({ request }) => {
    const res = await request.get('/ar');
    const h = res.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['content-security-policy']).toContain("default-src 'self'");
    expect(h['strict-transport-security']).toContain('max-age=');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['x-powered-by']).toBeUndefined();
    expect(h['set-cookie']).toBeUndefined();
  });

  test('pages load no third-party resources', async ({ page, baseURL }) => {
    const origins = new Set<string>();
    page.on('request', (r) => origins.add(new URL(r.url()).origin));
    await page.goto('/en');
    await page.goto('/ar/support');
    for (const o of origins)
      expect(o === new URL(baseURL!).origin || o === 'null' || o.startsWith('data:'), `third-party request to ${o}`).toBe(true);
  });

  test('sitemap lists both languages of every page; robots and metadata are present', async ({ request, page }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap.match(/<url>/g)?.length).toBe(16);
    expect(sitemap).toContain('/ar/support');
    expect(sitemap).toContain('/en/delete-account');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toMatch(/User-Agent: \*/i);
    await page.goto('/en/support');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/en\.png$/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /support/i);
    expect((await request.get('/og/ar.png')).status()).toBe(200);
  });
});

test.describe('accessibility (axe, WCAG 2.1 AA)', () => {
  for (const path of ['/ar', '/en', '/ar/support', '/en/support', '/ar/privacy', '/en/faq', '/ar/contact', '/en/delete-account']) {
    test(`${path} has no serious violations`, async ({ page }) => {
      // Reduced motion: the site then skips its fade-in, so axe measures final colors.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
});
