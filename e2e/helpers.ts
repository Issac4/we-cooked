import { expect, type Browser, type Page } from '@playwright/test';
import { ADMIN_PASSWORD } from '../playwright.config';

const shots = process.env.E2E_SCREENSHOTS;

/** Saves a full-page screenshot when E2E_SCREENSHOTS points at a folder. */
export async function shot(page: Page, name: string) {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

export async function unlockAdmin(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Admin password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
}

export async function createInviteLink(page: Page): Promise<string> {
  const code = page.getByRole('status').filter({ hasText: 'New invite link' }).locator('code');
  const before = (await code.count()) ? await code.textContent() : null;
  await page.getByRole('button', { name: 'Create invite link' }).click();
  // Wait for the new link, not the one shown from a previous click.
  await expect(code).not.toHaveText(before ?? '');
  return (await code.textContent())!.trim();
}

export async function join(browser: Browser, link: string, username: string, password: string, options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(link);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByRole('heading', { name: 'All recipes' })).toBeVisible();
  return { context, page };
}

/** Unlocks /admin in a fresh context and joins a new member with an invite. */
export async function newMember(browser: Browser, username: string, password = 'member-password-1', options = {}) {
  const admin = await (await browser.newContext()).newPage();
  await unlockAdmin(admin);
  const link = await createInviteLink(admin);
  await admin.context().close();
  return join(browser, link, username, password, options);
}

/** A small valid PNG (48x32, generated with sharp). */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAADAAAAAgCAIAAADbtmxLAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAASUlEQVRYhe2WAQkAQAwCl9Zc1ro2H2PPOFgAET03NF/drCtAQdGhmiFsWdbxg2CMDtUMYcuyDiF80KJDNUPYssihCMY6HRwe1wdaujqmJyffjgAAAABJRU5ErkJggg==',
  'base64',
);
