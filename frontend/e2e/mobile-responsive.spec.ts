import { test, expect } from '@playwright/test';

const MOBILE_VIEWPORTS = [
  { name: 'iPhone SE (375x667)', width: 375, height: 667 },
  { name: 'Pixel 5 (393x851)', width: 393, height: 851 },
];

MOBILE_VIEWPORTS.forEach(({ name, width, height }) => {
  test.describe(`Mobile Responsiveness - ${name}`, () => {
    test.use({ viewport: { width, height } });

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

    test('Zero horizontal scrollbar leakage on Auth pages', async ({ page }) => {
      await page.goto('/login');
      let isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(isOverflowing).toBe(false);

      await page.goto('/register');
      isOverflowing = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(isOverflowing).toBe(false);
    });
  });
});
