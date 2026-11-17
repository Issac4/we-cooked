import { expect, test } from '@playwright/test';
import { newMember, shot } from './helpers';

test('notes: post, edit own, others cannot, guests read only', async ({ browser }) => {
  const a = (await newMember(browser, 'Ah Ma')).page;
  const res = await a.request.post('/api/recipes', { data: { title: 'Steamed Egg', steps: [{ section: 'cooking', text: 'Steam 10 minutes.' }] } });
  const { id } = await res.json();

  await a.goto(`/recipes/${id}`);
  const box = a.getByLabel(/Add a note/);
  await box.fill('Strain the eggs for a silky top.');
  await a.getByRole('button', { name: 'Post note' }).click();
  await expect(a.getByText('Strain the eggs for a silky top.')).toBeVisible();
  await expect(box).toHaveValue('');

  await a.getByRole('button', { name: 'Edit', exact: true }).last().click();
  await a.getByLabel('Edit your note').fill('Strain the eggs twice for a silky top.');
  await a.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(a.getByText('Strain the eggs twice for a silky top.')).toBeVisible();
  await expect(a.getByText(/· edited/)).toBeVisible();

  const b = (await newMember(browser, 'Bo')).page;
  await b.goto(`/recipes/${id}`);
  await b.getByLabel(/Add a note/).fill('Cover with a plate, not foil.');
  await b.getByRole('button', { name: 'Post note' }).click();
  const notes = b.getByRole('region', { name: /Notes from the kitchen/ }).getByRole('article');
  await expect(notes.first()).toContainText('Cover with a plate');
  await expect(notes.nth(1)).toContainText('Strain the eggs twice');
  // Bo can manage Bo's note only.
  await expect(notes.first().getByRole('button', { name: 'Edit' })).toBeVisible();
  await expect(notes.nth(1).getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await shot(b, 'notes');

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`/recipes/${id}`);
  await expect(guest.getByText('Cover with a plate, not foil.')).toBeVisible();
  await expect(guest.getByLabel(/Add a note/)).toHaveCount(0);
  await expect(guest.getByText('to add a note.')).toBeVisible();

  b.on('dialog', (d) => d.accept());
  await notes.first().getByRole('button', { name: 'Delete' }).click();
  await expect(b.getByText('Cover with a plate, not foil.')).toHaveCount(0);
});

test('ratings: stars on a note, one vote per member in the score', async ({ browser }) => {
  const a = (await newMember(browser, 'Rater A')).page;
  const res = await a.request.post('/api/recipes', { data: { title: 'Butter Mochi Cake', steps: [{ section: 'cooking', text: 'Bake 30 minutes.' }] } });
  const { id } = await res.json();

  await a.goto(`/recipes/${id}`);
  const post = a.getByRole('button', { name: 'Post note' });
  await expect(post).toBeDisabled();
  // Rating alone is enough.
  await a.getByRole('radio', { name: '5 stars' }).click();
  await expect(a.getByText('5 of 5')).toBeVisible();
  await post.click();
  await expect(a.getByRole('link', { name: /5\.0/ })).toContainText('Rater A 5');

  // A later rating by the same member replaces theirs in the score.
  await a.getByLabel(/Add a note/).fill('A bit sweet; less sugar next time.');
  await a.getByRole('radio', { name: '4 stars' }).click();
  await post.click();
  await expect(a.getByRole('link', { name: /4\.0/ })).toContainText('Rater A 4');

  const b = (await newMember(browser, 'Rater B')).page;
  await b.goto(`/recipes/${id}`);
  await b.getByRole('radio', { name: '2 stars' }).click();
  await b.getByRole('button', { name: 'Post note' }).click();
  await expect(b.getByRole('link', { name: /3\.0/ })).toContainText('Rater A 4 · Rater B 2');
  const notes = b.getByRole('region', { name: /Notes from the kitchen/ }).getByRole('article');
  await expect(notes.first().getByRole('img', { name: '2 out of 5 stars' })).toBeVisible();

  await shot(b, 'ratings-recipe');

  // The card shows the score, and "Highest rated" is a sort option.
  await b.goto('/?sort=rating');
  await expect(b.getByRole('link', { name: /Butter Mochi Cake/ })).toContainText('3.0');
  await shot(b, 'ratings');
});
