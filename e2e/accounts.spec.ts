import { expect, test, type Page } from '@playwright/test';
import { createInviteLink, join as joinMember, shot, unlockAdmin } from './helpers';

async function join(browser: Parameters<typeof joinMember>[0], link: string, username: string, password: string) {
  const joined = await joinMember(browser, link, username, password);
  await expect(joined.page.getByRole('link', { name: new RegExp(username) }).first()).toBeVisible();
  return joined;
}

test.describe.serial('household accounts', () => {
  let adminPage: Page;
  let issac: Page;

  test('admin page stays locked without the shared password', async ({ browser }) => {
    adminPage = await (await browser.newContext()).newPage();
    await adminPage.goto('/admin');
    await shot(adminPage, 'admin-locked');
    await adminPage.getByLabel('Admin password').fill('not-it');
    await adminPage.getByRole('button', { name: 'Unlock' }).click();
    await expect(adminPage.getByText('Wrong admin password')).toBeVisible();
  });

  test('first member joins with an invite link and stays signed in', async ({ browser }) => {
    await unlockAdmin(adminPage);
    const link = await createInviteLink(adminPage);
    expect(link).toMatch(/\/join\//);
    await shot(adminPage, 'admin-invite');

    const joined = await join(browser, link, 'Issac', 'correct-horse-1');
    issac = joined.page;
    await expect(issac.getByRole('link', { name: /Issac/ })).toBeVisible();
    await shot(issac, 'home-member');

    // A fresh tab in the same browser is still signed in.
    const again = await joined.context.newPage();
    await again.goto('/me');
    await expect(again.getByRole('heading', { name: 'Me', exact: true })).toBeVisible();
    await again.close();

    // The used link no longer works.
    const stranger = await (await browser.newContext()).newPage();
    await stranger.goto(link);
    await expect(stranger.getByText('This invite link does not work')).toBeVisible();
  });

  test('guests see recipes but not the meal plan', async ({ browser }) => {
    const guest = await (await browser.newContext()).newPage();
    await guest.goto('/');
    await expect(guest.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
    await expect(guest.getByRole('link', { name: 'Meal plan' })).toHaveCount(0);
    await guest.goto('/plan');
    await expect(guest.getByText('The meal plan is for household members')).toBeVisible();
    await shot(guest, 'plan-guest');
  });

  test('member renames themselves and signs in elsewhere with the new name', async ({ browser }) => {
    await issac.goto('/me');
    await issac.getByLabel('Username').fill('Dad');
    await issac.getByRole('button', { name: 'Save' }).click();
    await expect(issac.getByRole('link', { name: /^DA Dad/ })).toBeVisible();
    await shot(issac, 'me-page');

    const laptop = await (await browser.newContext()).newPage();
    await laptop.goto('/login');
    await laptop.getByLabel('Username').fill('dad');
    await laptop.getByLabel('Password', { exact: true }).fill('correct-horse-1');
    await laptop.getByRole('button', { name: 'Sign in' }).click();
    await expect(laptop.getByRole('heading', { name: 'All recipes' })).toBeVisible();

    await issac.reload();
    // The laptop shows up as a second device that can be signed out from here.
    await expect(issac.getByRole('listitem').filter({ hasText: 'This device' })).toHaveCount(1);
    await expect(issac.getByRole('listitem').getByRole('button', { name: 'Sign out' })).toHaveCount(1);
  });

  test('forgotten password: admin makes a reset link, member picks a new password', async ({ browser }) => {
    const second = await join(browser, await createInviteLink(adminPage), 'Sam', 'sam-password-1');

    await adminPage.reload();
    const row = adminPage.getByRole('row', { name: /Sam/ });
    await row.getByRole('button', { name: 'Password reset link' }).click();
    const box = adminPage.getByRole('status').filter({ hasText: 'Password reset link for Sam' });
    const link = (await box.locator('code').textContent())!.trim();

    const phone = await (await browser.newContext()).newPage();
    await phone.goto(link);
    await expect(phone.getByText('For Sam')).toBeVisible();
    await phone.getByLabel('New password').fill('sam-new-password');
    await phone.getByRole('button', { name: 'Save and sign in' }).click();
    await expect(phone.getByText(/Your password was reset on/)).toBeVisible();
    await shot(phone, 'reset-notice');
    await phone.getByRole('button', { name: 'Got it' }).click();
    await expect(phone.getByText(/Your password was reset on/)).toHaveCount(0);

    // Sam's old device was signed out.
    await second.page.reload();
    await expect(second.page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();

    await adminPage.reload();
    await expect(adminPage.getByText('Sam set a new password with a reset link')).toBeVisible();
    await shot(adminPage, 'admin-dashboard');
  });

  test('phone layout uses the bottom tab bar', async ({ browser }) => {
    const context = await browser.newContext({ ...{ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } });
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByLabel('Username').fill('Dad');
    await page.getByLabel('Password', { exact: true }).fill('correct-horse-1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    const tabs = page.getByRole('navigation', { name: 'Main' });
    await expect(tabs.getByRole('link', { name: 'Plan' })).toBeVisible();
    await expect(tabs.getByRole('link', { name: 'Me' })).toBeVisible();
    await shot(page, 'phone-home');
  });
});
