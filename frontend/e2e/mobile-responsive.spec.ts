import { test, expect } from '@playwright/test';

const MOBILE_VIEWPORTS = [
  { name: 'iPhone SE (375x667)', width: 375, height: 667 },
  { name: 'Pixel 5 (393x851)', width: 393, height: 851 },
  { name: 'iPad Mini (768x1024)', width: 768, height: 1024 },
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
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const recipeCard = page.locator('a[href^="/recipe/"]').first();
      if (await recipeCard.isVisible()) {
        await recipeCard.click();
        await page.waitForLoadState('networkidle');

        const aside = page.locator('aside').first();
        await expect(aside).toBeVisible();

        const asidePosition = await aside.evaluate((el) => window.getComputedStyle(el).position);
        expect(asidePosition).not.toBe('sticky');
      }
    });
  });
});
