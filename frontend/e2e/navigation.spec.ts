import { test, expect } from '@playwright/test';

test.describe('Navigation & Page Loading', () => {
  const randomId = Math.floor(Math.random() * 10000);
  const username = `testuser_${randomId}`;
  const email = `test_${randomId}@example.com`;
  const password = 'Password123!';

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', err => console.error(`BROWSER CRASH: ${err.message}`));

    // Redirect localhost:8000 to backend:8000 for Docker networking
    await page.route(/.*localhost:8000.*/, async (route) => {
        const url = route.request().url();
        const newUrl = url.replace('localhost:8000', 'backend:8000');
        console.log(`E2E ROUTING: ${url} -> ${newUrl}`);
        await route.continue({ url: newUrl });
    });
  });

  test('should load all main pages after login', async ({ page }) => {
    // 0. Log in as default admin first because registration is admin-controlled
    await page.goto('/login');
    await page.getByLabel('Email or Username').fill('admin');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Wait for Dashboard to load first
    await expect(page).toHaveURL('http://localhost:5173/', { timeout: 15000 });

    // Click Admin Panel in the sidebar using client-side routing
    await page.getByRole('link', { name: 'Admin Panel', exact: true }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });

    // 1. Register new user (Admin registers them)
    await page.goto('/register');
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Register User' }).click();

    await expect(page).toHaveURL('http://localhost:5173/admin', { timeout: 15000 });

    // Log out admin
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    // Sign in as new user
    await page.getByLabel('Email or Username').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // 2. Dashboard
    await expect(page).toHaveURL('http://localhost:5173/');
    await expect(page.locator('h1')).toHaveText(/My Recipes/i);

    // 3. Add Recipe Page (Crucial check for SyntaxErrors in RecipeForm)
    await page.goto('/add-recipe');
    await expect(page).toHaveURL(/\/add-recipe/);
    await expect(page.getByText(/Create New Recipe/i)).toBeVisible();
    await expect(page.getByText(/Basic Information/i)).toBeVisible();

    // 4. Settings Page
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator('h1')).toHaveText(/Settings/i);
  });
});
