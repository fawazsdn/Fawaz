import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const STUB = 'http://127.0.0.1:54329';
let ipCounter = 0;
/** Each test is its own client (behind Vercel this header is set by the platform, not the visitor). */
const freshIp = (page: Page) => page.setExtraHTTPHeaders({ 'x-forwarded-for': `10.9.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}` });

async function stub(path: string, body?: unknown) {
  const res = await fetch(`${STUB}${path}`, { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined });
  return res.json();
}

/** Real sign-in flow: request the link (PKCE challenge stored in an httpOnly cookie), then open it. */
async function signIn(page: Page, email: string) {
  await page.goto('/admin/login');
  await page.getByLabel(/البريد الإلكتروني|Email/).fill(email);
  await page.getByRole('button', { name: /إرسال رابط الدخول|Email me a sign-in link/ }).click();
  await expect(page.getByRole('status')).toBeVisible();
  const { code } = await stub(`/__code?email=${encodeURIComponent(email)}`);
  expect(code).toBeTruthy();
  await page.goto(`/admin/auth/callback?code=${code}`);
}

test.beforeEach(async ({ page }) => {
  await stub('/__reset', {});
  await freshIp(page);
});

test.describe('access control', () => {
  test('signed-out visitors are sent to sign-in from every admin page', async ({ page, request }) => {
    for (const path of [
      '/admin',
      '/admin/tickets',
      '/admin/tickets/11111111-1111-4111-8111-111111111111',
      '/admin/customers',
      '/admin/analytics',
      '/admin/settings',
    ]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
    }
    const api = await request.get('/admin/api/open-count');
    expect(api.status()).toBe(401);
    expect(await api.text()).not.toMatch(/HR-|sara@/);
  });

  test('admin pages are never indexed or cached', async ({ request }) => {
    const res = await request.get('/admin/login');
    expect(res.headers()['x-robots-tag']).toContain('noindex');
    expect(res.headers()['cache-control']).toContain('no-store');
    expect(await (await request.get('/robots.txt')).text()).toBeTruthy();
  });

  test('sign-in never reveals whether an account exists and cannot create one', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('البريد الإلكتروني').fill('nobody@example.invalid');
    await page.getByRole('button', { name: 'إرسال رابط الدخول' }).click();
    await expect(page.getByRole('status')).toContainText('إن كان هذا البريد لحساب مصرّح له');
    expect((await stub('/__code?email=nobody%40example.invalid')).code).toBeNull();
  });

  test('sign-in requests are rate limited per email', async ({ page }) => {
    await page.goto('/admin/login');
    const email = page.getByLabel('البريد الإلكتروني');
    const send = page.getByRole('button', { name: 'إرسال رابط الدخول' });
    for (let i = 0; i < 3; i++) {
      await email.fill('limited@example.invalid');
      await send.click();
      await expect(page.getByRole('status')).toBeVisible();
    }
    await send.click();
    await expect(page.getByRole('alert').filter({ hasText: 'محاولات كثيرة' })).toBeVisible();
  });

  test('a forged or reused sign-in link is rejected', async ({ page }) => {
    await page.goto('/admin/auth/callback?code=not-a-real-code');
    await expect(page).toHaveURL(/error=link/);
    await expect(page.getByRole('alert').filter({ hasText: 'تعذّر إكمال الدخول' })).toBeVisible();
  });

  test('a signed-in non-staff resident is refused and signed out', async ({ page, request }) => {
    await signIn(page, 'resident@haratna.test');
    await expect(page).toHaveURL(/error=not_authorized/);
    await expect(page.getByRole('alert').filter({ hasText: 'ليس لديه صلاحية' })).toBeVisible();
    await page.goto('/admin/tickets');
    await expect(page).toHaveURL(/\/admin\/login/);
    expect((await request.get('/admin/api/open-count')).status()).toBe(401);
  });

  test('session cookies are httpOnly, SameSite=Lax and scoped to /admin', async ({ page, context }) => {
    await signIn(page, 'admin@haratna.test');
    await expect(page).toHaveURL(/\/admin$/);
    const auth = (await context.cookies()).filter((c) => c.name.startsWith('sb-'));
    expect(auth.length).toBeGreaterThan(0);
    for (const c of auth) {
      expect(c.httpOnly).toBe(true);
      expect(c.sameSite).toBe('Lax');
      expect(c.path).toBe('/admin');
    }
    expect(await page.evaluate(() => document.cookie)).not.toMatch(/sb-/);
  });
});

test.describe('dashboard (staff)', () => {
  test.describe.configure({ mode: 'serial' });
  let staffCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];
  // Sign in once (the per-email sign-in limit is 3 per 15 minutes) and reuse the session.
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await freshIp(page);
    await signIn(page, 'admin@haratna.test');
    await expect(page).toHaveURL(/\/admin$/);
    staffCookies = await context.cookies();
    await context.close();
  });
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies(staffCookies);
    await page.goto('/admin');
  });

  test('overview shows live statistics, chart and recent requests', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'نظرة عامة' })).toBeVisible();
    const stats = page.getByTestId('stats');
    await expect(stats.getByText('إجمالي الطلبات').locator('..')).toContainText('3');
    await expect(stats.getByText('مفتوحة', { exact: true }).locator('..')).toContainText('2');
    await expect(page.getByRole('img', { name: /حجم الطلبات/ })).toBeVisible();
    await expect(page.getByTestId('ticket-list').getByRole('link')).toHaveCount(3);
    await expect(page.getByTestId('open-count')).toContainText('2');
  });

  test('filters and search narrow the request list', async ({ page }) => {
    await page.goto('/admin/tickets?status=open');
    await expect(page.getByTestId('ticket-list').getByRole('link')).toHaveCount(2);
    await page.goto('/admin/tickets?source=app');
    await expect(page.getByTestId('ticket-list')).toContainText('HR-APP00002');
    await expect(page.getByTestId('ticket-list').getByRole('link')).toHaveCount(1);
    await page.goto('/admin/tickets');
    await page.getByLabel('بحث بالرقم أو البريد أو النص').fill('sara@example');
    await page.getByRole('button', { name: 'تطبيق' }).click();
    await expect(page).toHaveURL(/q=sara/);
    await expect(page.getByTestId('ticket-list').getByRole('link')).toHaveCount(1);
    await page.goto('/admin/tickets?category=general&status=bogus&source=evil');
    await expect(page.getByTestId('ticket-list')).toContainText('HR-WEB00003');
  });

  test('reply to a website request: saved, emailed, delivery confirmed, no duplicate send', async ({ page }) => {
    await page.goto('/admin/tickets?q=HR-WEB00001');
    await page.getByRole('link', { name: /HR-WEB00001/ }).click();
    await expect(page.getByTestId('ticket-message')).toContainText('outside my neighborhood');
    await expect(page.getByText('sara@example.invalid')).toBeVisible();
    await page.getByLabel('اكتب الرد').fill('Please enable Precise Location and try again.');
    await page.getByRole('button', { name: 'حفظ وإرسال بالبريد' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'قَبِله مزوّد البريد' }).or(page.getByText('وقَبِل مزوّد البريد الرسالة')),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('ticket-response')).toContainText('Precise Location');
    await expect(page.getByTestId('email-panel')).toContainText('قَبِله مزوّد البريد');
    await expect(page.getByText('Fawaz Admin').first()).toBeVisible();
    // Provider-confirmed delivery only after checking with the provider.
    await page.getByRole('button', { name: 'تحديث حالة التسليم' }).click();
    await expect(page.getByText('تم تحديث حالة التسليم.')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('email-panel')).toContainText('تم التسليم');
    await expect(page.getByRole('button', { name: 'إرسال الرد بالبريد' })).toHaveCount(0);
    const state = await stub('/__state');
    expect(state.uniqueSends).toBe(1);
  });

  test('email failure is reported honestly and can be retried without duplicates', async ({ page }) => {
    await stub('/__control', { resendMode: 'fail' });
    await page.goto('/admin/tickets?q=HR-WEB00001');
    await page.getByRole('link', { name: /HR-WEB00001/ }).click();
    await page.getByLabel('اكتب الرد').fill('We are looking into it.');
    await page.getByRole('button', { name: 'حفظ وإرسال بالبريد' }).click();
    await expect(page.getByText('فشل إرسال البريد')).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.getByTestId('email-panel')).toContainText('فشل الإرسال');
    await expect(page.getByTestId('email-panel')).toContainText('500');
    await stub('/__control', { resendMode: 'ok' });
    await page.getByRole('button', { name: 'إعادة المحاولة' }).click();
    await expect(page.getByText('وقَبِل مزوّد البريد الرسالة')).toBeVisible();
    const state = await stub('/__state');
    expect(state.uniqueSends).toBe(1);
  });

  test('app requests keep the in-app reply flow; status can be closed and reopened', async ({ page }) => {
    await page.goto('/admin/tickets?source=app');
    await page.getByRole('link', { name: /HR-APP00002/ }).click();
    await expect(page.getByText('Rami Resident')).toBeVisible();
    await expect(page.getByText('طلب من التطبيق')).toBeVisible();
    await expect(page.getByRole('button', { name: 'حفظ وإرسال بالبريد' })).toHaveCount(0);
    await page.getByLabel('اكتب الرد').fill('Fixed in the next update.');
    await page.getByRole('button', { name: 'حفظ الرد' }).click();
    await expect(page.getByText('إرسال إشعار داخل التطبيق')).toBeVisible();
    await page.getByRole('button', { name: 'إغلاق الطلب' }).click();
    await expect(page.getByText('تم تحديث الحالة')).toBeVisible();
    await page.reload();
    await expect(page.locator('h1').locator('..')).toContainText('مغلق');
    await page.getByRole('button', { name: 'إعادة فتح' }).click();
    await expect(page.getByText('تم تحديث الحالة')).toBeVisible();
    await page.reload();
    await expect(page.locator('h1').locator('..')).toContainText('مفتوح');
  });

  test('empty replies cannot be submitted (the server and database also reject them)', async ({ page }) => {
    await page.goto('/admin/tickets?q=HR-WEB00001');
    await page.getByRole('link', { name: /HR-WEB00001/ }).click();
    await page.getByLabel('اكتب الرد').fill('   ');
    await expect(page.getByRole('button', { name: 'حفظ وإرسال بالبريد' })).toBeDisabled();
  });

  test('customers group requests and show history only', async ({ page }) => {
    await page.goto('/admin/customers');
    await expect(page.getByRole('link', { name: 'Sara' })).toBeVisible();
    await page.getByRole('link', { name: 'Rami Resident' }).click();
    await expect(page.getByTestId('ticket-list')).toContainText('HR-APP00002');
  });

  test('analytics and settings render real configuration without secrets', async ({ page }) => {
    await page.goto('/admin/analytics?days=7');
    await expect(page.getByRole('heading', { name: 'التحليلات' })).toBeVisible();
    await expect(page.getByText('حسب الموضوع')).toBeVisible();
    await page.goto('/admin/settings');
    await expect(page.getByTestId('email-config')).toContainText('مُعدّ');
    await expect(page.getByTestId('email-config')).toContainText('support@haratna.test');
    expect(await page.content()).not.toContain('re_stub_key_never_shown');
  });

  test('new requests raise the open count on refresh', async ({ page }) => {
    await expect(page.getByTestId('open-count')).toContainText('2');
    await stub('/__add-ticket', {});
    await page.getByRole('button', { name: 'تحديث' }).click();
    await expect(page.getByTestId('open-count')).toContainText('3');
  });

  test('English layout is LTR and Arabic is RTL; mobile has no horizontal scroll', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/admin', '/admin/tickets', '/admin/settings']) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    await page.getByRole('button', { name: 'العربية' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('logout ends the session', async ({ page, request }) => {
    await page.goto('/admin/settings');
    await page.getByRole('button', { name: 'تسجيل الخروج من هذا الجهاز' }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    expect((await request.get('/admin/api/open-count')).status()).toBe(401);
  });
});
