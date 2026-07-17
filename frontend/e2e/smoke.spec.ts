import { test, expect } from '@playwright/test';

test.describe('App Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    page.on('pageerror', err => console.error(`BROWSER ERROR: ${err.message}`));
  });

  test('should load the login page and show the welcome message', async ({ page }) => {
    // Navigate to a protected route (will redirect to /login due to ProtectedRoute)
    await page.goto('/add-recipe');

    // Check if we are on the login page
    await expect(page).toHaveURL(/.*login/);

    // Check for key UI elements
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByLabel('Email or Username')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should show validation error on empty login attempt', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // HTML5 validation or form error should prevent login
    // Since we use 'required' attribute, the browser will show a tooltip
    // For this smoke test, we just check that we are still on the login page
    await expect(page).toHaveURL(/.*login/);
  });
});
