import { expect, test } from '@playwright/test';

const mode = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.dataset.theme);
const background = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('colour mode: Light, Dark or Auto, remembered by this browser', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'light', viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto('/');
  const sidebar = page.getByRole('complementary').getByRole('group', { name: 'Colour mode' });

  // Auto follows the device.
  await expect(sidebar.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
  expect(await mode(page)).toBe('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => mode(page)).toBe('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => mode(page)).toBe('light');
  const lightBg = await background(page);

  // Dark overrides a light device, and survives a reload.
  await sidebar.getByRole('button', { name: 'Dark' }).click();
  await expect.poll(() => mode(page)).toBe('dark');
  expect(await background(page)).not.toBe(lightBg);
  await page.reload();
  expect(await mode(page)).toBe('dark');
  await expect(sidebar.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#171512');

  // Light overrides a dark device.
  await page.emulateMedia({ colorScheme: 'dark' });
  await sidebar.getByRole('button', { name: 'Light' }).click();
  await expect.poll(() => mode(page)).toBe('light');
  await page.reload();
  expect(await mode(page)).toBe('light');

  // Another browser is unaffected.
  const other = await (await browser.newContext({ colorScheme: 'dark' })).newPage();
  await other.goto('/');
  expect(await mode(other)).toBe('dark');
  await context.close();
});
