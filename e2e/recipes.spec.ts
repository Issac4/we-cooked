import { expect, test, type Page } from '@playwright/test';
import { newMember, PNG, shot } from './helpers';

test.describe.serial('recipes', () => {
  let cook: Page;
  let recipeUrl = '';

  test('a member adds a recipe with sections, tags, steps and a photo', async ({ browser }) => {
    cook = (await newMember(browser, 'Cook')).page;
    await cook.getByRole('link', { name: 'New recipe' }).first().click();
    await expect(cook.getByRole('heading', { name: 'New recipe' })).toBeVisible();

    await cook.getByLabel('Name', { exact: true }).fill('Soy Sauce Chicken');
    await cook.getByLabel('Other name (optional)').fill('豉油雞');
    await cook.getByLabel('Serves').fill('4');
    await cook.getByLabel('Prep (min)').fill('10');
    await cook.getByLabel('Cook (min)').fill('35');
    await cook.locator('input[type=file]').setInputFiles({ name: 'chicken.png', mimeType: 'image/png', buffer: PNG });
    await expect(cook.getByAltText('Cover photo preview')).toBeVisible();

    // Filters, including a brand-new one made on the spot.
    await cook.getByRole('main').getByRole('button', { name: 'Chicken', exact: true }).click();
    await cook.getByRole('main').getByRole('button', { name: 'Dinner', exact: true }).click();
    const cuisine = cook.getByRole('main').locator('div').filter({ has: cook.getByRole('heading', { name: 'Cuisine', exact: true }) }).last();
    await cuisine.getByRole('button', { name: '+ New' }).click();
    await cook.getByLabel('New tag in Cuisine').fill('Hakka');
    await cook.getByLabel('New tag in Cuisine').press('Enter');
    await expect(cook.getByRole('main').getByRole('button', { name: 'Hakka', pressed: true })).toBeVisible();

    // Ingredients: Enter in the name adds the next row.
    const amounts = cook.getByLabel('Amount');
    const names = cook.getByLabel('Ingredient', { exact: true });
    await amounts.nth(0).fill('1');
    await cook.getByLabel('Unit').nth(0).fill('whole');
    await names.nth(0).fill('chicken');
    await names.nth(0).press('Enter');
    await expect(amounts.nth(1)).toBeFocused();
    await amounts.nth(1).fill('1/2');
    await cook.getByLabel('Unit').nth(1).fill('cup');
    await names.nth(1).fill('light soy sauce');

    await cook.getByRole('button', { name: 'Add section (e.g. Marinade)' }).click();
    await cook.getByLabel('Section name', { exact: true }).fill('Marinade');
    await amounts.last().fill('2');
    await cook.getByLabel('Unit').last().fill('tbsp');
    await names.last().fill('Shaoxing wine');

    const stepTexts = cook.getByLabel('What to do');
    await stepTexts.nth(0).fill('Pat the chicken dry.');
    await stepTexts.nth(1).fill('Simmer on **low** heat.');
    await cook.getByPlaceholder('min').nth(1).fill('15');

    await cook.getByRole('button', { name: 'Add link' }).click();
    await cook.getByLabel('Link', { exact: true }).fill('https://example.com/soy-chicken');
    await cook.getByLabel('Link title').fill('Family notes');

    await shot(cook, 'recipe-form');
    await cook.getByRole('button', { name: 'Save recipe' }).click();

    await expect(cook.getByRole('heading', { name: 'Soy Sauce Chicken' })).toBeVisible();
    recipeUrl = cook.url();
    await expect(cook.getByText('豉油雞')).toBeVisible();
    await expect(cook.getByRole('heading', { name: 'Marinade' })).toBeVisible();
    await expect(cook.getByRole('heading', { name: 'Preparation' })).toBeVisible();
    await expect(cook.getByRole('heading', { name: 'Cooking' })).toBeVisible();
    await expect(cook.locator('strong', { hasText: 'low' })).toBeVisible();
    await expect(cook.getByRole('button', { name: 'Start 15 min timer' })).toBeVisible();
    await expect(cook.getByText('½ cup')).toBeVisible();

    // Doubling servings doubles the amounts.
    for (let i = 0; i < 4; i++) await cook.getByRole('button', { name: 'More servings' }).click();
    await expect(cook.getByText('Serves 8')).toBeVisible();
    await expect(cook.getByText('1 cup')).toBeVisible();
    await expect(cook.getByText('4 tbsp')).toBeVisible();
    await shot(cook, 'recipe-page');
  });

  test('the list filters by pills and searches both names', async () => {
    await cook.goto('/');
    await expect(cook.getByRole('link', { name: /Soy Sauce Chicken/ })).toBeVisible();
    await cook.getByRole('complementary').getByRole('button', { name: 'Beef', exact: true }).click();
    await expect(cook.getByText('No recipes match')).toBeVisible();
    await cook.getByRole('button', { name: 'Clear filters' }).click();
    await cook.getByRole('complementary').getByRole('button', { name: 'Chicken', exact: true }).click();
    await expect(cook.getByRole('link', { name: /Soy Sauce Chicken/ })).toBeVisible();
    await expect(cook).toHaveURL(/tags=/);
    await cook.getByLabel('Search recipes').fill('豉油');
    await expect(cook).toHaveURL(/q=/);
    await expect(cook.getByText('1 recipe', { exact: true })).toBeVisible();
    await shot(cook, 'recipe-list');
  });

  test('guests can read but see no edit controls', async ({ browser }) => {
    const guest = await (await browser.newContext()).newPage();
    await guest.goto(recipeUrl);
    await expect(guest.getByRole('heading', { name: 'Soy Sauce Chicken' })).toBeVisible();
    await expect(guest.getByRole('link', { name: 'Edit' })).toHaveCount(0);
    await expect(guest.getByRole('button', { name: 'Move to Trash' })).toHaveCount(0);
    await guest.goto(`${recipeUrl}/edit`);
    await expect(guest.getByText('Editing recipes is for household members')).toBeVisible();
  });

  test('two people editing: the later save is refused instead of overwriting', async ({ browser }) => {
    const other = (await newMember(browser, 'Helper')).page;
    await cook.goto(`${recipeUrl}/edit`);
    await other.goto(`${recipeUrl}/edit`);
    await expect(other.getByLabel('Name', { exact: true })).toHaveValue('Soy Sauce Chicken');

    await other.getByLabel('Name', { exact: true }).fill('Soy Sauce Chicken (less sugar)');
    await other.getByRole('button', { name: 'Save changes' }).click();
    await expect(other.getByRole('heading', { name: 'Soy Sauce Chicken (less sugar)' })).toBeVisible();
    await expect(other.getByText(/last edited by Helper/)).toBeVisible();

    await cook.getByLabel('Name', { exact: true }).fill('My version');
    await cook.getByRole('button', { name: 'Save changes' }).click();
    await expect(cook.getByText(/Someone else saved this recipe while you were editing/)).toBeVisible();
  });

  test('unsaved work comes back as a draft', async () => {
    cook.on('dialog', (d) => d.accept());
    await cook.goto('/recipes/new');
    await cook.getByLabel('Name', { exact: true }).fill('Half-written congee');
    await cook.waitForTimeout(600); // draft is written after a short pause
    await cook.reload();
    await cook.getByRole('button', { name: 'Restore' }).click();
    await expect(cook.getByLabel('Name', { exact: true })).toHaveValue('Half-written congee');
    await cook.getByRole('link', { name: 'Cancel' }).click();
  });

  test('Trash: move, undo from the notice, move again, restore from the Trash page', async () => {
    await cook.goto(recipeUrl);
    await cook.getByRole('button', { name: 'Move to Trash' }).click();
    await expect(cook.getByText(/Moved “.*” to the Trash/)).toBeVisible();
    await cook.getByRole('button', { name: 'Undo' }).click();
    await expect(cook.getByRole('heading', { name: /Soy Sauce Chicken/ })).toBeVisible();

    await cook.getByRole('button', { name: 'Move to Trash' }).click();
    await expect(cook.getByRole('heading', { name: 'All recipes' })).toBeVisible();
    await cook.getByRole('link', { name: 'Trash' }).click();
    await expect(cook.getByText(/Deleted by Cook/)).toBeVisible();
    await shot(cook, 'trash');
    await cook.getByRole('button', { name: 'Restore' }).click();
    await expect(cook.getByText('The Trash is empty.')).toBeVisible();
  });

  test('phone: filters open in a bottom sheet', async ({ browser }) => {
    const phone = (await newMember(browser, 'Phone', 'member-password-1', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).page;
    await phone.getByRole('button', { name: 'Filters' }).click();
    const sheet = phone.getByRole('dialog', { name: 'Filters' });
    await sheet.getByRole('button', { name: 'Chicken', exact: true }).click();
    await shot(phone, 'phone-filter-sheet');
    await sheet.getByRole('button', { name: /^Show 1 recipe$/ }).click();
    await expect(phone.getByRole('button', { name: 'Remove filter Chicken' })).toBeVisible();
    await shot(phone, 'phone-recipes');
  });
});
