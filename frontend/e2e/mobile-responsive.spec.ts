import { test, expect } from '@playwright/test';

const MOBILE_VIEWPORTS = [
  { name: 'iPhone SE (375x667)', width: 375, height: 667 },
  { name: 'Pixel 5 (393x851)', width: 393, height: 851 },
  { name: 'Large Mobile (414x896)', width: 414, height: 896 },
];

MOBILE_VIEWPORTS.forEach(({ name, width, height }) => {
  test.describe(`Mobile Responsiveness - ${name}`, () => {
    test.use({ viewport: { width, height } });

    test.beforeEach(async ({ page }) => {
      await page.route(/.*localhost:8000.*/, async (route) => {
        const url = route.request().url();
        await route.continue({ url: url.replace('localhost:8000', 'backend:8000') });
      });
    });

    test('Zero horizontal scrollbar leakage on Dashboard page', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(isOverflowing).toBe(false);
    });

    test('Mobile header hamburger menu opens drawer and handles navigation', async ({ page }) => {
      await page.goto('/');

      // Top header hamburger button must be visible on small viewports
      const menuButton = page.getByRole('button', { name: /open navigation menu|navigation menu/i });
      await expect(menuButton).toBeVisible();

      // Open drawer
      await menuButton.click();

      // Mobile drawer close button inside Sidebar must be visible
      const closeButton = page.getByRole('button', { name: 'Close drawer' });
      await expect(closeButton).toBeVisible();

      // Click close button to dismiss drawer
      await closeButton.click();
      await expect(closeButton).not.toBeVisible();
    });

    test('Dashboard search and sort toolbar controls fit within mobile screen width', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(isOverflowing).toBe(false);
    });

    test('Zero horizontal scrollbar leakage on Auth and Form pages', async ({ page }) => {
      await page.goto('/login');
      let isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(isOverflowing).toBe(false);

      await page.goto('/register');
      isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(isOverflowing).toBe(false);

      await page.goto('/add-recipe');
      isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(isOverflowing).toBe(false);
    });

    test('Recipe details sidebar does not stick on mobile viewports', async ({ page }) => {
      const randomId = Math.floor(Math.random() * 100000);
      const testUser = `mobile_user_${randomId}`;
      const testEmail = `mobile_${randomId}@example.com`;
      const testPass = 'Password123!';

      // 1. Log in as admin to register a regular user
      await page.goto('/login');
      await page.getByLabel('Email or Username').fill('admin');
      await page.getByLabel('Password').fill('admin123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL('http://localhost:5173/', { timeout: 15000 });

      // 2. Register regular user
      await page.goto('/register');
      await page.getByLabel('Username').fill(testUser);
      await page.getByLabel('Email').fill(testEmail);
      await page.getByLabel('Password').fill(testPass);
      await page.getByRole('button', { name: 'Register User' }).click();
      await expect(page).toHaveURL('http://localhost:5173/admin', { timeout: 15000 });

      // 3. Log out admin and log in as regular user
      await page.goto('/login');
      await page.getByLabel('Email or Username').fill(testUser);
      await page.getByLabel('Password').fill(testPass);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL('http://localhost:5173/', { timeout: 15000 });

      // 4. Navigate to /add-recipe as regular user
      await page.goto('/add-recipe');
      await expect(page.getByLabel(/Recipe Title/i)).toBeVisible({ timeout: 15000 });
      await page.getByLabel(/Recipe Title/i).fill('Mobile Test Recipe');

      const ingredientInput = page.getByPlaceholder(/e\.g\. Chicken Breast/i).first();
      if (await ingredientInput.isVisible()) {
        await ingredientInput.fill('Chicken Breast');
      }

      const prepStepInput = page.getByPlaceholder(/e\.g\. Chop onions/i).first();
      if (await prepStepInput.isVisible()) {
        await prepStepInput.fill('Dice Chicken');
      }

      await page.getByRole('button', { name: /Save Recipe/i }).click();

      // 5. Verify redirection to Recipe Details page
      await expect(page).toHaveURL(/\/recipe\/\d+/, { timeout: 15000 });

      // 6. Assert sidebar is visible and position is not sticky on mobile
      const aside = page.locator('aside').first();
      await expect(aside).toBeVisible();

      const asidePosition = await aside.evaluate((el) => window.getComputedStyle(el).position);
      expect(asidePosition).not.toBe('sticky');
    });
  });
});
