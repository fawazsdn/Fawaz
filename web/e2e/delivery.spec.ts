import { expect, test } from '@playwright/test';

/**
 * Files a REAL ticket through the form into the production support inbox.
 * Opt-in only: E2E_LIVE=1 npm run e2e -- delivery
 * The ticket is clearly labelled as an automated test.
 */
test.skip(!process.env.E2E_LIVE, 'set E2E_LIVE=1 to file a real test ticket');

test('a visitor files a ticket and gets a reference number', async ({ page }) => {
  await page.goto('/en/support');
  await page.getByLabel('Email', { exact: true }).fill('website-delivery-test@example.invalid');
  await page.getByLabel('Topic', { exact: true }).selectOption('other');
  await page.getByLabel('Subject', { exact: true }).fill('[Automated test] Website support form delivery');
  await page
    .getByLabel('Details', { exact: true })
    .fill('Automated end-to-end test of the website support form. No action needed; close this ticket.');
  await page.waitForTimeout(3_200); // the form's minimum fill time
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('We received your request')).toBeVisible({ timeout: 15_000 });
  const reference = (await page.locator('p.font-mono').innerText()).trim();
  expect(reference).toMatch(/^HR-[0-9A-F]{8}$/);
  console.log(`DELIVERED ${reference}`);
});
