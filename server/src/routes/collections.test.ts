import { describe, expect, it } from 'vitest';
import { Client, createMember, makeTestApp, recipeBody } from '../test/helpers.js';

describe('collections', () => {
  it('members create, fill, filter, rename and delete; recipes always stay', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const a = (await member.post('/api/recipes', recipeBody({ title: 'Soy Sauce Chicken' }))).json;
    const b = (await member.post('/api/recipes', recipeBody({ title: 'Tomato Beef Rice' }))).json;
    const c = (await member.post('/api/recipes', recipeBody({ title: 'Lemon Tart' }))).json;

    const res = await member.post('/api/collections', { name: 'Weeknight', description: 'Under 30 min', color: 'orange' });
    expect(res.status).toBe(201);
    const weeknight = res.json;
    expect(weeknight).toMatchObject({ name: 'Weeknight', color: 'orange', recipeCount: 0 });
    expect((await member.post('/api/collections', { name: 'weeknight' })).status).toBe(409);

    expect((await member.post(`/api/collections/${weeknight.id}/recipes`, { recipeIds: [a.id, b.id] })).json.added).toBe(2);
    // Adding again is harmless.
    expect((await member.post(`/api/collections/${weeknight.id}/recipes`, { recipeIds: [a.id, c.id] })).json.added).toBe(1);

    const guest = new Client(app);
    const titles = async (qs: string) => ((await guest.get(`/api/recipes?${qs}`)).json.recipes as any[]).map((r) => r.title).sort();
    expect(await titles(`collection=${weeknight.id}`)).toEqual(['Lemon Tart', 'Soy Sauce Chicken', 'Tomato Beef Rice']);
    expect(await titles(`collection=${weeknight.id}&q=beef`)).toEqual(['Tomato Beef Rice']);
    expect((await guest.get('/api/recipes?collection=9999')).status).toBe(404);

    expect((await guest.get(`/api/recipes/${a.id}`)).json.collections).toEqual([{ id: weeknight.id, name: 'Weeknight', color: 'orange' }]);

    await member.del(`/api/collections/${weeknight.id}/recipes/${c.id}`);
    expect((await guest.get('/api/collections')).json[0].recipeCount).toBe(2);

    // Trashed recipes don't count.
    await member.del(`/api/recipes/${b.id}`);
    expect((await guest.get('/api/collections')).json[0].recipeCount).toBe(1);

    expect((await member.patch(`/api/collections/${weeknight.id}`, { name: 'Weeknight 30-min', description: '', color: 'green' })).json.name).toBe('Weeknight 30-min');
    expect((await member.del(`/api/collections/${weeknight.id}`)).status).toBe(200);
    expect((await guest.get('/api/collections')).json).toEqual([]);
    expect((await guest.get('/api/recipes')).json.total).toBe(2);
  });

  it('is read-only for guests', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const col = (await member.post('/api/collections', { name: 'CNY' })).json;
    const guest = new Client(app);
    expect((await guest.get('/api/collections')).status).toBe(200);
    expect((await guest.post('/api/collections', { name: 'X' })).status).toBe(401);
    expect((await guest.post(`/api/collections/${col.id}/recipes`, { recipeIds: [1] })).status).toBe(401);
    expect((await guest.del(`/api/collections/${col.id}`)).status).toBe(401);
  });

  it('rejects unknown colours and recipes', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    expect((await member.post('/api/collections', { name: 'X', color: 'hotpink' })).status).toBe(400);
    const col = (await member.post('/api/collections', { name: 'Y' })).json;
    expect((await member.post(`/api/collections/${col.id}/recipes`, { recipeIds: [12345] })).status).toBe(400);
  });
});
