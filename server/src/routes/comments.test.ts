import { describe, expect, it } from 'vitest';
import { Client, createMember, makeTestApp, recipeBody } from '../test/helpers.js';

describe('notes on recipes', () => {
  it('members write notes, newest first; guests read only', async () => {
    const { app } = makeTestApp();
    const { member: issac } = await createMember(app, 'Issac');
    const { member: sam } = await createMember(app, 'Sam');
    const { id } = (await issac.post('/api/recipes', recipeBody())).json;

    const first = await sam.post(`/api/recipes/${id}/comments`, { body: 'Lee Kum Kee premium soy worked better.' });
    expect(first.status).toBe(201);
    expect(first.json).toMatchObject({ author: 'Sam', mine: true, editedAt: null });
    await issac.post(`/api/recipes/${id}/comments`, { body: 'Kids found it sweet; try 45 g sugar.' });

    const guest = new Client(app);
    const list = (await guest.get(`/api/recipes/${id}/comments`)).json;
    expect(list.map((c: any) => c.author)).toEqual(['Issac', 'Sam']);
    expect(list.every((c: any) => c.mine === false)).toBe(true);
    expect((await guest.post(`/api/recipes/${id}/comments`, { body: 'hi' })).status).toBe(401);
    expect((await guest.del(`/api/comments/${first.json.id}`)).status).toBe(401);
  });

  it('only the author can edit or delete a note', async () => {
    const { app } = makeTestApp();
    const { member: issac } = await createMember(app, 'Issac');
    const { member: sam } = await createMember(app, 'Sam');
    const { id } = (await issac.post('/api/recipes', recipeBody())).json;
    const note = (await sam.post(`/api/recipes/${id}/comments`, { body: 'Too salty' })).json;

    expect((await issac.patch(`/api/comments/${note.id}`, { body: 'Hacked' })).status).toBe(403);
    expect((await issac.del(`/api/comments/${note.id}`)).status).toBe(403);

    const edited = await sam.patch(`/api/comments/${note.id}`, { body: 'Too salty with dark soy' });
    expect(edited.json.body).toBe('Too salty with dark soy');
    expect(edited.json.editedAt).toBeGreaterThan(0);
    expect((await sam.del(`/api/comments/${note.id}`)).status).toBe(200);
    expect((await sam.get(`/api/recipes/${id}/comments`)).json).toEqual([]);
  });

  it('refuses empty notes and notes on missing or trashed recipes', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const { id } = (await member.post('/api/recipes', recipeBody())).json;
    expect((await member.post(`/api/recipes/${id}/comments`, { body: '   ' })).status).toBe(400);
    expect((await member.post('/api/recipes/9999/comments', { body: 'x' })).status).toBe(404);
    await member.del(`/api/recipes/${id}`);
    expect((await member.post(`/api/recipes/${id}/comments`, { body: 'x' })).status).toBe(404);
  });

  it('keeps notes from a removed member, without a name', async () => {
    const { app } = makeTestApp();
    const { member: issac } = await createMember(app, 'Issac');
    const { member: sam, admin, id: samId } = await createMember(app, 'Sam');
    const { id } = (await issac.post('/api/recipes', recipeBody())).json;
    await sam.post(`/api/recipes/${id}/comments`, { body: 'Use less ginger' });
    await admin.del(`/api/admin/members/${samId}`);
    const list = (await issac.get(`/api/recipes/${id}/comments`)).json;
    expect(list[0]).toMatchObject({ author: null, body: 'Use less ginger', mine: false });
  });
  it('takes an optional 1–5 rating; a note needs text, a rating, or both', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const { id } = (await member.post('/api/recipes', recipeBody())).json;
    const url = `/api/recipes/${id}/comments`;

    expect((await member.post(url, { body: 'Plain tip' })).json.rating).toBeNull();
    expect((await member.post(url, { rating: 4 })).json).toMatchObject({ body: '', rating: 4 });
    expect((await member.post(url, { body: '', rating: null })).status).toBe(400);
    expect((await member.post(url, { body: 'x', rating: 6 })).status).toBe(400);
    expect((await member.post(url, { body: 'x', rating: 0 })).status).toBe(400);
    expect((await member.post(url, { body: 'x', rating: 3.5 })).status).toBe(400);

    const note = (await member.post(url, { body: 'Good', rating: 5 })).json;
    expect((await member.patch(`/api/comments/${note.id}`, { body: 'Good', rating: null })).json.rating).toBeNull();
  });

  it('scores a recipe with one vote per member: their latest rating', async () => {
    const { app } = makeTestApp();
    const { member: issac } = await createMember(app, 'Issac');
    const { member: bethany } = await createMember(app, 'Bethany');
    const { member: dad } = await createMember(app, 'Dad');
    const cake = (await issac.post('/api/recipes', recipeBody({ title: 'Mochi Cake' }))).json.id;
    const congee = (await issac.post('/api/recipes', recipeBody({ title: 'Congee' }))).json.id;
    const tart = (await issac.post('/api/recipes', recipeBody({ title: 'Tart' }))).json.id;
    await issac.post('/api/recipes', recipeBody({ title: 'Unrated' }));

    // Issac rates the cake ten times; it still counts once, and only the latest (4) counts.
    for (let i = 0; i < 9; i++) await issac.post(`/api/recipes/${cake}/comments`, { rating: 5 });
    await issac.post(`/api/recipes/${cake}/comments`, { body: 'Less sugar next time', rating: 4 });
    await bethany.post(`/api/recipes/${cake}/comments`, { rating: 5 });
    await dad.post(`/api/recipes/${cake}/comments`, { rating: 2 });
    await dad.post(`/api/recipes/${cake}/comments`, { body: 'No rating, just a tip' });

    const r = (await new Client(app).get(`/api/recipes/${cake}`)).json;
    expect(r.rating).toEqual({
      average: 3.7, // (4 + 5 + 2) / 3
      count: 3,
      people: [
        { name: 'Bethany', rating: 5 },
        { name: 'Dad', rating: 2 },
        { name: 'Issac', rating: 4 },
      ],
    });

    await bethany.post(`/api/recipes/${congee}/comments`, { rating: 5 });
    await issac.post(`/api/recipes/${tart}/comments`, { rating: 5 });
    await bethany.post(`/api/recipes/${tart}/comments`, { rating: 5 });
    const list = (await issac.get('/api/recipes?sort=rating')).json.recipes;
    // Tart (5.0, 2 votes) > Congee (5.0, 1 vote) > Mochi Cake (3.7) > unrated
    expect(list.map((x: any) => x.title)).toEqual(['Tart', 'Congee', 'Mochi Cake', 'Unrated']);
    expect(list[3].rating).toBeNull();
  });
});
