import { test, expect } from '@playwright/test';

test.describe('Recipe App Full Flow (Unmocked)', () => {
  const randomId = Math.floor(Math.random() * 10000);
  const username = `e2e_user_${randomId}`;
  const email = `e2e_${randomId}@example.com`;
  const password = 'Password123!';

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
    page.on('pageerror', err => console.error(`BROWSER ERROR: ${err.message}`));
    
    // Redirect localhost:8000 to backend:8000 for Docker networking
    await page.route(/.*localhost:8000.*/, async (route) => {
        const url = route.request().url();
        const newUrl = url.replace('localhost:8000', 'backend:8000');
        console.log(`E2E ROUTING: ${url} -> ${newUrl}`);
        await route.continue({ url: newUrl });
    });
  });

  test('Full User Journey: Register, Login, Dashboard, Logout', async ({ page }) => {
    console.log('--- STARTING UNMOCKED REGISTER TEST ---');
    
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
    
    // Go to register page to add a new user
    await page.goto('/register');
    
    // 1. Registration (Admin registers new user)
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Register User' }).click();

    // After registration, admin is still logged in and redirects/navigates back to admin portal/dashboard
    await expect(page).toHaveURL('http://localhost:5173/admin', { timeout: 15000 });
    
    // Log out admin
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
    console.log('Admin registered new user and logged out');

    // 2. Sign In as new user
    await page.getByLabel('Email or Username').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should redirect to Dashboard
    await expect(page).toHaveURL('http://localhost:5173/', { timeout: 15000 });
    await expect(page.locator('h1')).toHaveText(/My Recipes/i);
    console.log('Successfully logged into Dashboard as new user');

    // 3. Verify Dashboard State (Resilient Check)
    const emptyState = page.getByText(/No recipes found/i);
    const recipeCard = page.getByRole('link', { name: /View Details/i }).first();
    
    await expect(emptyState.or(recipeCard)).toBeVisible({ timeout: 15000 });
    console.log('Verified Dashboard content is visible');

    // 4. Sign Out
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
    console.log('Successfully logged out');
  });

  test('Security: Redirect unauthenticated users', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/add-recipe');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
