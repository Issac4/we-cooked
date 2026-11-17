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
});
