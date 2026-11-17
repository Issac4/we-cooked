import { expect, test, type Page } from '@playwright/test';
import { newMember, shot } from './helpers';

/** Quick recipe through the API (shares the page's sign-in cookie). */
async function addRecipe(page: Page, title: string, tagIds: number[] = []) {
  const res = await page.request.post('/api/recipes', {
    data: { title, steps: [{ section: 'cooking', text: 'Cook it.' }], tagIds },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id as number;
}

test.describe.serial('collections', () => {
  let page: Page;
  let congeeId = 0;

  test('create a collection from the sidebar and fill it with the picker', async ({ browser }) => {
    page = (await newMember(browser, 'Planner')).page;
    const groups = await (await page.request.get('/api/tags')).json();
    const breakfast = groups.flatMap((g: any) => g.tags).find((t: any) => t.name === 'Breakfast').id;
    congeeId = await addRecipe(page, 'Chicken Congee', [breakfast]);
    await addRecipe(page, 'Tomato Beef Rice');
    await addRecipe(page, 'Lemon Tart');
    await page.reload();

    const sidebar = page.getByRole('complementary');
    await sidebar.getByRole('button', { name: 'New collection' }).click();
    const dialog = page.getByRole('dialog', { name: 'New collection' });
    await dialog.getByLabel('Name').fill('Weeknight');
    await dialog.getByLabel('Description (optional)').fill('Done in 30 minutes');
    await dialog.getByRole('button', { name: 'orange' }).click();
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByRole('heading', { name: 'Weeknight' })).toBeVisible();
    await expect(page.getByText('Nothing in Weeknight yet')).toBeVisible();

    await page.getByRole('button', { name: 'Add recipes' }).first().click();
    const picker = page.getByRole('dialog', { name: 'Add recipes to Weeknight' });
    await picker.getByLabel('Search recipes').fill('c');
    await picker.getByText('Chicken Congee').click();
    await picker.getByLabel('Search recipes').fill('');
    await picker.getByText('Tomato Beef Rice').click();
    await shot(page, 'collection-picker');
    await picker.getByRole('button', { name: 'Add 2 recipes' }).click();

    await expect(page.getByText('2 recipes', { exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Weeknight\s*2/ })).toBeVisible();
    await shot(page, 'collection-view');
  });

  test('pills filter inside the collection, with a way out to all recipes', async () => {
    await page.getByRole('complementary').getByRole('button', { name: 'Breakfast', exact: true }).click();
    await expect(page.getByText('1 recipe of 2 match')).toBeVisible();
    await page.getByLabel('Search recipes').fill('tart');
    await expect(page.getByText('No matches in Weeknight')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByLabel('Search recipes')).toHaveValue('');
    await expect(page.getByText('2 recipes', { exact: true })).toBeVisible();
    await page.getByLabel('Search recipes').fill('tart');
    await page.getByRole('button', { name: 'Search all recipes' }).click();
    await expect(page.getByRole('heading', { name: 'All recipes' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Lemon Tart/ })).toBeVisible();
    await page.getByLabel('Search recipes').fill('');
  });

  test('toggle membership from the recipe page, and remove from a card', async () => {
    await page.goto(`/recipes/${congeeId}`);
    await expect(page.getByRole('main').getByRole('link', { name: 'Weeknight' })).toBeVisible();
    await page.getByRole('button', { name: 'Collection', exact: true }).click();
    await page.getByRole('button', { name: 'New collection…' }).click();
    const dialog = page.getByRole('dialog', { name: 'New collection' });
    await dialog.getByLabel('Name').fill('Kids’ favourites');
    await dialog.getByRole('button', { name: 'Create' }).click();
    // Creating from a recipe jumps to the new collection; go back and tick it.
    await page.goto(`/recipes/${congeeId}`);
    await page.getByRole('button', { name: 'Collection', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Kids’ favourites' }).check();
    await page.getByRole('checkbox', { name: 'Weeknight' }).uncheck();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('main').getByRole('link', { name: 'Kids’ favourites' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Weeknight' })).toHaveCount(0);
    await shot(page, 'recipe-collections');

    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: /Kids’ favourites/ }).click();
    await page.getByRole('button', { name: 'Remove from Kids’ favourites' }).click();
    await expect(page.getByText('Nothing in Kids’ favourites yet')).toBeVisible();
  });

  test('guests see collections but cannot change them', async ({ browser }) => {
    const guest = await (await browser.newContext()).newPage();
    await guest.goto('/');
    const sidebar = guest.getByRole('complementary');
    await sidebar.getByRole('link', { name: /Weeknight/ }).click();
    await expect(guest.getByRole('heading', { name: 'Weeknight' })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Add recipes' })).toHaveCount(0);
    await expect(sidebar.getByRole('button', { name: 'New collection' })).toHaveCount(0);
    await expect(guest.getByText(/Remove from/)).toHaveCount(0);
  });

  test('deleting a collection keeps its recipes', async () => {
    page.on('dialog', (d) => d.accept());
    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: /Weeknight/ }).click();
    await page.getByRole('button', { name: 'Delete collection' }).click();
    await expect(page.getByRole('heading', { name: 'All recipes' })).toBeVisible();
    await expect(page.getByRole('complementary').getByRole('link', { name: /Weeknight/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Tomato Beef Rice/ })).toBeVisible();
  });

  test('phone: Collections tab lists them', async ({ browser }) => {
    const phone = (await newMember(browser, 'Pocket', 'member-password-1', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).page;
    await phone.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Collections' }).click();
    await phone.getByRole('link', { name: /Kids’ favourites/ }).click();
    await expect(phone.getByRole('heading', { name: 'Kids’ favourites' })).toBeVisible();
    await expect(phone.getByRole('button', { name: 'Leave collection Kids’ favourites' })).toBeVisible();
    await shot(phone, 'phone-collection');
  });
});
