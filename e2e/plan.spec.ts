import { expect, test, type Locator, type Page } from '@playwright/test';
import { newMember, shot } from './helpers';

/** Tuesday 17 Nov 2026 in the browser, so weeks and "today" are stable. */
const NOW = new Date('2026-11-17T10:00:00');

function cellAdd(page: Page, row: string, day: string) {
  return page.getByRole('button', { name: `Add to ${row} on ${day}` });
}
function entry(page: Page, label: string) {
  return page.getByRole('group', { name: label });
}

/** Drag with real mouse moves (dnd-kit needs a few pixels of movement to start). */
async function drag(page: Page, from: Locator, to: Locator, alt = false) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  if (alt) await page.keyboard.down('Alt');
  await page.mouse.move(a.x + 20, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + 30, a.y + a.height / 2, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
  if (alt) await page.keyboard.up('Alt');
}

test.describe.serial('meal plan', () => {
  let page: Page;
  let recipeId = 0;

  test('add a recipe to three days at once, and plain text', async ({ browser }) => {
    page = (await newMember(browser, 'Chef', 'member-password-1', { viewport: { width: 1440, height: 1000 } })).page;
    await page.clock.setFixedTime(NOW);
    const res = await page.request.post('/api/recipes', { data: { title: 'Braised Pork Belly', steps: [{ section: 'cooking', text: 'Simmer.' }] } });
    recipeId = (await res.json()).id;

    await page.goto('/plan');
    await expect(page.getByText('16 – 22 Nov 2026')).toBeVisible();
    await expect(page.getByText('Today', { exact: true })).toBeVisible();

    await cellAdd(page, 'Dinner', 'Monday 16 Nov').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Type a dish, or search your recipes').fill('pork');
    await dialog.getByRole('button', { name: /^Wed\s*18/ }).click();
    await dialog.getByRole('button', { name: /^Fri\s*20/ }).click();
    await expect(dialog.getByRole('heading', { name: /\+ 2 more/ })).toBeVisible();
    await shot(page, 'plan-add-dialog');
    await dialog.getByRole('button', { name: /Braised Pork Belly/ }).click();
    await expect(entry(page, 'Braised Pork Belly')).toHaveCount(3);

    await cellAdd(page, 'Lunch', 'Tuesday 17 Nov').click();
    await page.getByLabel('Type a dish, or search your recipes').fill('Leftovers');
    await page.getByLabel('Type a dish, or search your recipes').press('Enter');
    await expect(entry(page, 'Leftovers')).toHaveCount(1);

    // Recently planned items show when the box is empty.
    await cellAdd(page, 'Lunch', 'Wednesday 18 Nov').click();
    await expect(page.getByRole('dialog').getByRole('button', { name: /Leftovers/ })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('add a row and move it between Lunch and Dinner', async () => {
    await page.getByRole('button', { name: 'Add row' }).click();
    await page.getByLabel('Row name').fill('Kids’ snack');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Options for row Kids’ snack' }).click();
    await page.getByRole('menuitem', { name: 'Move up' }).click();
    const labels = page.locator('[aria-label^="Options for row "]');
    await expect(labels).toHaveCount(4);
    await expect.poll(async () => (await labels.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))))).toEqual([
      'Options for row Breakfast',
      'Options for row Lunch',
      'Options for row Kids’ snack',
      'Options for row Dinner',
    ]);
  });

  test('an away weekend greys out those days', async () => {
    await page.getByRole('button', { name: 'Add event' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add event' });
    await dialog.getByLabel('What is happening').fill('Weekend trip');
    await dialog.getByLabel('From').fill('2026-11-21');
    await dialog.getByLabel('To').fill('2026-11-22');
    await dialog.getByRole('button', { name: 'Add event' }).click();
    await expect(page.getByRole('button', { name: /Weekend trip · away, no meals at home/ })).toBeVisible();
    await expect(page.getByText('Away', { exact: true })).toHaveCount(8); // 2 days × 4 rows
    await expect(cellAdd(page, 'Dinner', 'Saturday 21 Nov')).toHaveCount(0);
    await shot(page, 'plan-week');
  });

  test('drag moves an entry; Alt-drag copies it', async () => {
    const dest = page.getByRole('button', { name: 'Add to Lunch on Thursday 19 Nov' });
    await drag(page, entry(page, 'Leftovers'), dest);
    await expect(page.getByRole('button', { name: 'Add to Lunch on Tuesday 17 Nov' })).toBeVisible();
    await expect(entry(page, 'Leftovers')).toHaveCount(1);
    await drag(page, entry(page, 'Leftovers'), page.getByRole('button', { name: 'Add to Lunch on Friday 20 Nov' }), true);
    await expect(entry(page, 'Leftovers')).toHaveCount(2);
  });

  test('repeat an entry into next week, then copy a whole week', async () => {
    await page.getByRole('button', { name: 'Options for Leftovers' }).first().click();
    await page.getByRole('menuitem', { name: 'Repeat on other days…' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Thursday 26 Nov' }).click();
    await dialog.getByRole('button', { name: 'Add to 1 day' }).click();
    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(page.getByText('23 – 29 Nov 2026')).toBeVisible();
    await expect(entry(page, 'Leftovers')).toHaveCount(1);

    await page.getByRole('button', { name: 'Next week' }).click();
    await expect(page.getByText('30 Nov – 6 Dec 2026')).toBeVisible();
    await page.getByRole('button', { name: 'Copy last week' }).click();
    await expect(entry(page, 'Leftovers')).toHaveCount(1);
    await expect(page.getByText(/Copied 1 meals from last week/)).toBeVisible();
  });

  test('holidays turn red; week can start on Sunday', async () => {
    await page.goto('/settings');
    await page.getByLabel('Country').selectOption({ label: 'Canada' });
    await page.getByLabel('Province / state (optional)').selectOption({ label: 'Ontario' });
    await page.getByRole('button', { name: 'Add calendar' }).click();
    await expect(page.getByText('Canada · Ontario').first()).toBeVisible();
    await expect(page.getByText(/Christmas Day/).first()).toBeVisible();
    await page.getByRole('group', { name: 'Week starts on' }).getByRole('button', { name: 'sunday' }).click();
    await shot(page, 'settings-plan');

    await page.goto('/plan?week=2026-12-21');
    await expect(page.getByText('20 – 26 Dec 2026')).toBeVisible();
    await expect(page.getByText('Christmas Day')).toBeVisible();
    await expect(page.getByText('Boxing Day')).toBeVisible();
    await shot(page, 'plan-christmas');
    await page.goto('/settings');
    await page.getByRole('group', { name: 'Week starts on' }).getByRole('button', { name: 'monday' }).click();
    await expect(page.getByRole('group', { name: 'Week starts on' }).getByRole('button', { name: 'monday' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('add to plan from a recipe; its cooking history shows the days', async () => {
    await page.goto(`/recipes/${recipeId}`);
    await expect(page.getByText(/On the plan 1 time in the past year · last Mon 16 Nov · next Wed 18 Nov/)).toBeVisible();
    await page.getByRole('button', { name: 'Add to plan' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Next week' }).click();
    await dialog.getByRole('button', { name: /^Tuesday 24 Nov/ }).click();
    await dialog.getByRole('button', { name: 'Lunch', exact: true }).click();
    await dialog.getByRole('button', { name: 'Add to 1 day' }).click();
    await expect(page.getByText('Added to Lunch on Tue 24.')).toBeVisible();
    await shot(page, 'recipe-history');
  });

  test('phone shows one card per day', async ({ browser }) => {
    const phone = (await newMember(browser, 'Phone cook', 'member-password-1', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).page;
    await phone.clock.setFixedTime(NOW);
    await phone.goto('/plan');
    await expect(phone.getByRole('heading', { name: /Today · Tue 17 Nov/ })).toBeVisible();
    await phone.getByRole('button', { name: 'Add to Breakfast, Wednesday 18 Nov' }).click();
    await phone.getByLabel('Type a dish, or search your recipes').fill('Oatmeal');
    await phone.getByLabel('Type a dish, or search your recipes').press('Enter');
    await expect(phone.getByRole('group', { name: 'Oatmeal' })).toBeVisible();
    await shot(phone, 'phone-plan');

    // Cooking history opens on the latest weeks (scrolled to the right end).
    await phone.goto(`/recipes/${recipeId}`);
    const history = phone.getByTestId('history-scroll');
    await expect(history).toBeVisible();
    const pos = await history.evaluate((el) => ({ left: el.scrollLeft, width: el.clientWidth, total: el.scrollWidth }));
    expect(pos.total).toBeGreaterThan(pos.width);
    expect(pos.left + pos.width).toBeGreaterThanOrEqual(pos.total - 1);
  });
});
