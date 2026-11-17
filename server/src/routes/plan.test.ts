import { describe, expect, it } from 'vitest';
import { purgeTrash } from '../recipes/service.js';
import { Client, createMember, makeTestApp, recipeBody } from '../test/helpers.js';

const WEEK = 'from=2026-11-16&to=2026-11-22';

async function setup() {
  const t = makeTestApp();
  const { member } = await createMember(t.app, 'Issac');
  const view = (await member.get(`/api/plan?${WEEK}`)).json;
  const rowId = (name: string) => view.rows.find((r: any) => r.name === name).id as number;
  return { ...t, member, view, dinner: rowId('Dinner'), lunch: rowId('Lunch'), breakfast: rowId('Breakfast') };
}

describe('meal plan', () => {
  it('is for members only', async () => {
    const { app } = makeTestApp();
    const guest = new Client(app);
    expect((await guest.get(`/api/plan?${WEEK}`)).status).toBe(401);
    expect((await guest.post('/api/plan/entries', { dates: ['2026-11-16'], rowId: 1, text: 'x' })).status).toBe(401);
    expect((await guest.get('/api/settings')).status).toBe(401);
  });

  it('starts with Breakfast, Lunch and Dinner and a Monday week', async () => {
    const { view } = await setup();
    expect(view.rows.map((r: any) => r.name)).toEqual(['Breakfast', 'Lunch', 'Dinner']);
    expect(view.weekStart).toBe('monday');
    expect(view.entries).toEqual([]);
  });

  it('adds a recipe to several days at once, and plain text', async () => {
    const { member, dinner, lunch } = await setup();
    const { id } = (await member.post('/api/recipes', recipeBody({ title: 'Soy Sauce Chicken' }))).json;
    const added = await member.post('/api/plan/entries', { dates: ['2026-11-16', '2026-11-18', '2026-11-20'], rowId: dinner, recipeId: id });
    expect(added.status).toBe(201);
    expect(added.json).toHaveLength(3);
    await member.post('/api/plan/entries', { dates: ['2026-11-16'], rowId: dinner, text: 'Stir-fried choy sum' });
    await member.post('/api/plan/entries', { dates: ['2026-11-16'], rowId: lunch, text: 'Leftovers' });

    const entries = (await member.get(`/api/plan?${WEEK}`)).json.entries;
    const monDinner = entries.filter((e: any) => e.date === '2026-11-16' && e.rowId === dinner);
    expect(monDinner.map((e: any) => [e.label, e.recipeId !== null, e.position])).toEqual([
      ['Soy Sauce Chicken', true, 0],
      ['Stir-fried choy sum', false, 1],
    ]);
    expect((await member.post('/api/plan/entries', { dates: ['2026-11-16'], rowId: dinner })).status).toBe(400);
    expect((await member.post('/api/plan/entries', { dates: ['2026-02-30'], rowId: dinner, text: 'x' })).status).toBe(400);
  });

  it('follows recipe renames, and keeps the name if the recipe is deleted', async () => {
    const { member, db, dinner } = await setup();
    const r = (await member.post('/api/recipes', recipeBody({ title: 'Congee' }))).json;
    await member.post('/api/plan/entries', { dates: ['2026-11-17'], rowId: dinner, recipeId: r.id });
    await member.put(`/api/recipes/${r.id}`, { ...recipeBody({ title: 'Chicken Congee' }), baseUpdatedAt: r.updatedAt });
    expect((await member.get(`/api/plan?${WEEK}`)).json.entries[0].label).toBe('Chicken Congee');

    await member.del(`/api/recipes/${r.id}`);
    const trashed = (await member.get(`/api/plan?${WEEK}`)).json.entries[0];
    expect(trashed).toMatchObject({ recipeId: null });
    db.$client.prepare('update recipes set deleted_at = ?').run(Date.now() - 40 * 86_400_000);
    purgeTrash(db);
    expect((await member.get(`/api/plan?${WEEK}`)).json.entries[0]).toMatchObject({ recipeId: null, label: 'Congee' });
  });

  it('moves and copies entries between cells', async () => {
    const { member, dinner, lunch } = await setup();
    const [e] = (await member.post('/api/plan/entries', { dates: ['2026-11-16'], rowId: dinner, text: 'Hotpot' })).json;
    await member.patch(`/api/plan/entries/${e.id}`, { date: '2026-11-21', rowId: lunch });
    await member.patch(`/api/plan/entries/${e.id}`, { date: '2026-11-22', rowId: lunch, copy: true });
    const entries = (await member.get(`/api/plan?${WEEK}`)).json.entries;
    expect(entries.map((x: any) => [x.date, x.rowId, x.label])).toEqual([
      ['2026-11-21', lunch, 'Hotpot'],
      ['2026-11-22', lunch, 'Hotpot'],
    ]);
    expect((await member.del(`/api/plan/entries/${e.id}`)).status).toBe(200);
    expect((await member.del(`/api/plan/entries/${e.id}`)).status).toBe(200);
  });

  it('copies last week into an empty week only', async () => {
    const { member, dinner } = await setup();
    await member.post('/api/plan/entries', { dates: ['2026-11-09', '2026-11-13'], rowId: dinner, text: 'Fish' });
    const res = await member.post('/api/plan/copy-week', { from: '2026-11-09', to: '2026-11-16' });
    expect(res.json.copied).toBe(2);
    expect((await member.get(`/api/plan?${WEEK}`)).json.entries.map((e: any) => e.date)).toEqual(['2026-11-16', '2026-11-20']);
    expect((await member.post('/api/plan/copy-week', { from: '2026-11-09', to: '2026-11-16' })).status).toBe(409);
  });

  it('adds, renames, reorders and removes rows', async () => {
    const { member, dinner, breakfast, lunch } = await setup();
    const snack = (await member.post('/api/plan/rows', { name: 'Kids’ snack' })).json;
    await member.request('PUT', '/api/plan/rows/order', { ids: [breakfast, lunch, snack.id, dinner] });
    await member.patch(`/api/plan/rows/${snack.id}`, { name: 'Snack' });
    expect((await member.get(`/api/plan?${WEEK}`)).json.rows.map((r: any) => r.name)).toEqual(['Breakfast', 'Lunch', 'Snack', 'Dinner']);
    expect((await member.request('PUT', '/api/plan/rows/order', { ids: [breakfast, lunch] })).status).toBe(409);

    await member.post('/api/plan/entries', { dates: ['2026-11-16'], rowId: snack.id, text: 'Apple' });
    await member.del(`/api/plan/rows/${snack.id}`);
    const view = (await member.get(`/api/plan?${WEEK}`)).json;
    expect(view.rows).toHaveLength(3);
    expect(view.entries).toEqual([]);
  });

  it('shows events that overlap the week', async () => {
    const { member } = await setup();
    await member.post('/api/plan/events', { name: 'Weekend trip', from: '2026-11-21', to: '2026-11-23', away: true });
    await member.post('/api/plan/events', { name: 'Last month', from: '2026-10-01', to: '2026-10-03', away: true });
    expect((await member.post('/api/plan/events', { name: 'Backwards', from: '2026-11-20', to: '2026-11-19' })).status).toBe(400);
    const events = (await member.get(`/api/plan?${WEEK}`)).json.events;
    expect(events).toEqual([{ id: expect.any(Number), name: 'Weekend trip', from: '2026-11-21', to: '2026-11-23', away: true }]);
  });

  it('lists recently planned items without repeats', async () => {
    const { member, dinner } = await setup();
    const { id } = (await member.post('/api/recipes', recipeBody({ title: 'Steamed Egg' }))).json;
    await member.post('/api/plan/entries', { dates: ['2026-11-16'], rowId: dinner, recipeId: id });
    await member.post('/api/plan/entries', { dates: ['2026-11-17'], rowId: dinner, text: 'Leftovers' });
    await member.post('/api/plan/entries', { dates: ['2026-11-18'], rowId: dinner, recipeId: id });
    await member.post('/api/plan/entries', { dates: ['2026-11-19'], rowId: dinner, text: 'leftovers' });
    expect((await member.get('/api/plan/recent')).json).toEqual([
      { label: 'leftovers', recipeId: null },
      { label: 'Steamed Egg', recipeId: id },
    ]);
  });

  it('gives a recipe’s cooking history from the plan', async () => {
    const { member, dinner, lunch } = await setup();
    const { id } = (await member.post('/api/recipes', recipeBody())).json;
    await member.post('/api/plan/entries', { dates: ['2026-11-09'], rowId: dinner, recipeId: id });
    await member.post('/api/plan/entries', { dates: ['2026-11-19'], rowId: lunch, recipeId: id });
    await member.post('/api/plan/entries', { dates: ['2024-01-01'], rowId: lunch, recipeId: id });
    const history = (await member.get(`/api/plan/history/${id}?today=2026-11-17`)).json;
    expect(history.days).toEqual([
      { date: '2026-11-09', row: 'Dinner' },
      { date: '2026-11-19', row: 'Lunch' },
    ]);
  });
});

describe('household settings and holidays', () => {
  it('stores week start and holiday calendars, and lists public holidays', async () => {
    const { member } = await setup();
    expect((await member.patch('/api/settings', { holidayCalendars: ['XX'] })).status).toBe(400);
    expect((await member.patch('/api/settings', { holidayCalendars: ['CA-ZZ'] })).status).toBe(400);
    const saved = await member.patch('/api/settings', { weekStart: 'sunday', holidayCalendars: ['CA-ON', 'HK'] });
    expect(saved.json).toMatchObject({ weekStart: 'sunday', holidayCalendars: ['CA-ON', 'HK'] });

    const view = (await member.get('/api/plan?from=2026-12-20&to=2026-12-31')).json;
    expect(view.weekStart).toBe('sunday');
    expect(view.holidays).toEqual([
      { date: '2026-12-25', name: 'Christmas Day', calendar: 'CA-ON, HK' },
      { date: '2026-12-26', name: 'Boxing Day', calendar: 'CA-ON, HK' },
    ]);

    await member.patch('/api/settings', { hiddenHolidays: ['2026-12-26'], extraHolidays: [{ date: '2026-12-31', name: 'Family reunion' }] });
    const after = (await member.get('/api/plan?from=2026-12-20&to=2026-12-31')).json.holidays;
    expect(after.map((h: any) => [h.date, h.name])).toEqual([
      ['2026-12-25', 'Christmas Day'],
      ['2026-12-31', 'Family reunion'],
    ]);
  });

  it('lists countries with their regions for the picker', async () => {
    const { member } = await setup();
    const options = (await member.get('/api/settings/calendars')).json;
    const canada = options.find((o: any) => o.code === 'CA');
    expect(canada.regions).toContainEqual({ code: 'CA-ON', name: 'Ontario' });
    expect(options.find((o: any) => o.code === 'HK')).toBeTruthy();
  });

  it('refuses ranges that are too long or malformed', async () => {
    const { member } = await setup();
    expect((await member.get('/api/plan?from=2026-01-01&to=2026-06-01')).status).toBe(400);
    expect((await member.get('/api/plan?from=nope&to=2026-06-01')).status).toBe(400);
  });
});
