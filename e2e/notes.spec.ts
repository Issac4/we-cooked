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
