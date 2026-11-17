import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { cleanOrphanUploads } from './uploads.js';
import { purgeTrash } from '../recipes/service.js';
import { Client, createMember, makeTestApp, recipeBody } from '../test/helpers.js';

async function tagId(client: Client, name: string): Promise<number> {
  const groups = (await client.get('/api/tags')).json as Array<{ tags: Array<{ id: number; name: string }> }>;
  const tag = groups.flatMap((g) => g.tags).find((t) => t.name === name);
  if (!tag) throw new Error(`no tag ${name}`);
  return tag.id;
}

describe('browsing', () => {
  it('starts with the default filter groups and no recipes', async () => {
    const { app } = makeTestApp();
    const guest = new Client(app);
    const groups = (await guest.get('/api/tags')).json;
    expect(groups.map((g: any) => g.name)).toEqual(['Protein', 'Meal', 'Cuisine']);
    expect((await guest.get('/api/recipes')).json).toEqual({ recipes: [], total: 0 });
  });

  it('lets guests read recipes but not write', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const created = (await member.post('/api/recipes', recipeBody())).json;
    const guest = new Client(app);
    expect((await guest.get(`/api/recipes/${created.id}`)).json.title).toBe('Soy Sauce Chicken');
    expect((await guest.post('/api/recipes', recipeBody())).status).toBe(401);
    expect((await guest.put(`/api/recipes/${created.id}`, { ...recipeBody(), baseUpdatedAt: created.updatedAt })).status).toBe(401);
    expect((await guest.del(`/api/recipes/${created.id}`)).status).toBe(401);
    expect((await guest.get('/api/trash')).status).toBe(401);
    expect((await guest.post('/api/tags/groups', { name: 'X' })).status).toBe(401);
  });

  it('filters by all selected tags, searches names and ingredients, and sorts', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const chicken = await tagId(member, 'Chicken');
    const dinner = await tagId(member, 'Dinner');
    const breakfast = await tagId(member, 'Breakfast');
    await member.post('/api/recipes', recipeBody({ title: 'Soy Sauce Chicken', otherName: '豉油雞', tagIds: [chicken, dinner], prepMins: 10, cookMins: 35 }));
    await member.post('/api/recipes', recipeBody({ title: 'Chicken Congee', otherName: '雞粥', tagIds: [chicken, breakfast], prepMins: 5, cookMins: 55 }));
    await member.post('/api/recipes', recipeBody({
      title: 'Apple Tart', otherName: '', tagIds: [], prepMins: 5, cookMins: 10,
      ingredients: [{ name: '', items: [{ quantity: 3, unit: '', name: 'Fuji apples', note: '' }] }],
    }));

    const titles = async (qs: string) => ((await member.get(`/api/recipes?${qs}`)).json.recipes as any[]).map((r) => r.title);
    expect(await titles(`tags=${chicken}`)).toHaveLength(2);
    expect(await titles(`tags=${chicken},${dinner}`)).toEqual(['Soy Sauce Chicken']);
    expect(await titles('q=congee')).toEqual(['Chicken Congee']);
    expect(await titles('q=雞')).toHaveLength(2);
    expect(await titles('q=fuji')).toEqual(['Apple Tart']);
    expect(await titles('q=100%')).toEqual([]);
    expect(await titles('sort=title')).toEqual(['Apple Tart', 'Chicken Congee', 'Soy Sauce Chicken']);
    expect(await titles('sort=time')).toEqual(['Apple Tart', 'Soy Sauce Chicken', 'Chicken Congee']);
    expect(await titles('sort=new')).toEqual(['Apple Tart', 'Chicken Congee', 'Soy Sauce Chicken']);

    const card = (await member.get(`/api/recipes?tags=${dinner}`)).json.recipes[0];
    expect(card.tags.map((t: any) => t.name)).toEqual(['Chicken', 'Dinner']);
  });
});

describe('creating and editing', () => {
  it('stores the full recipe with author names', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const res = await member.post('/api/recipes', recipeBody());
    expect(res.status).toBe(201);
    const r = (await new Client(app).get(`/api/recipes/${res.json.id}`)).json;
    expect(r.otherName).toBe('豉油雞');
    expect(r.ingredients[0].items[1]).toEqual({ quantity: 250, unit: 'ml', name: 'light soy sauce', note: '' });
    expect(r.steps.map((s: any) => s.section)).toEqual(['preparation', 'cooking']);
    expect(r.createdBy).toBe('Issac');
    expect(r.updatedBy).toBe('Issac');
    expect(r.needsReview).toBe(false);
  });

  it('explains what is wrong with a bad recipe', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const res = await member.post('/api/recipes', recipeBody({
      title: '  ',
      steps: [{ section: 'frying', text: 'x' }],
    }));
    expect(res.status).toBe(400);
    expect(res.json.fields.title).toBeTruthy();
    expect(res.json.fields['steps.0.section']).toBeTruthy();
  });

  it('rejects unknown tags and lists how to find the right ones', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const res = await member.post('/api/recipes', recipeBody({ tagIds: [9999] }));
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/9999.*GET \/api\/tags/);
  });

  it('lets any member edit anyone’s recipe, and refuses a stale save', async () => {
    const { app } = makeTestApp();
    const { member: issac } = await createMember(app, 'Issac');
    const { member: sam } = await createMember(app, 'Sam');
    const created = (await issac.post('/api/recipes', recipeBody())).json;

    const samSave = await sam.put(`/api/recipes/${created.id}`, { ...recipeBody({ title: 'Better Soy Chicken' }), baseUpdatedAt: created.updatedAt });
    expect(samSave.status).toBe(200);
    expect(samSave.json.updatedBy).toBe('Sam');
    expect(samSave.json.createdBy).toBe('Issac');

    // Issac still has the old version open.
    const stale = await issac.put(`/api/recipes/${created.id}`, { ...recipeBody({ title: 'Mine' }), baseUpdatedAt: created.updatedAt });
    expect(stale.status).toBe(409);
    expect((await issac.get(`/api/recipes/${created.id}`)).json.title).toBe('Better Soy Chicken');
  });

  it('drops empty ingredient sections', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const res = await member.post('/api/recipes', recipeBody({
      ingredients: [{ name: 'Sauce', items: [] }, { name: '', items: [{ quantity: null, unit: 'a pinch', name: 'salt', note: '' }] }],
    }));
    expect(res.json.ingredients).toEqual([{ name: '', items: [{ quantity: null, unit: 'a pinch', name: 'salt', note: '' }] }]);
  });
});

describe('Trash', () => {
  it('hides deleted recipes, restores them, and purges after 30 days', async () => {
    const { app, db } = makeTestApp();
    const { member: issac } = await createMember(app, 'Issac');
    const { member: sam } = await createMember(app, 'Sam');
    const { id } = (await issac.post('/api/recipes', recipeBody())).json;

    expect((await sam.del(`/api/recipes/${id}`)).status).toBe(200);
    expect((await new Client(app).get(`/api/recipes/${id}`)).status).toBe(404);
    expect((await issac.get('/api/recipes')).json.total).toBe(0);
    const trash = (await issac.get('/api/trash')).json;
    expect(trash[0]).toMatchObject({ id, title: 'Soy Sauce Chicken', deletedBy: 'Sam' });

    expect((await issac.post(`/api/trash/${id}/restore`)).status).toBe(200);
    expect((await issac.get('/api/recipes')).json.total).toBe(1);

    await issac.del(`/api/recipes/${id}`);
    db.$client.prepare('update recipes set deleted_at = ? where id = ?').run(Date.now() - 31 * 86_400_000, id);
    expect(purgeTrash(db)).toBe(1);
    expect((await issac.get('/api/trash')).json).toEqual([]);
  });
});

describe('photos', () => {
  async function bigPhoto() {
    return sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#c86' } }).jpeg().toBuffer();
  }

  it('resizes to WebP with a thumbnail and serves both', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const res = await member.upload('/api/uploads', await bigPhoto());
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ width: 1600, height: 1067 });

    const full = await app.request(`/uploads/${res.json.id}.webp`);
    expect(full.status).toBe(200);
    expect(full.headers.get('content-type')).toBe('image/webp');
    expect(full.headers.get('cache-control')).toMatch(/immutable/);
    const thumb = Buffer.from(await (await app.request(`/uploads/${res.json.id}-thumb.webp`)).arrayBuffer());
    expect((await sharp(thumb).metadata()).width).toBe(640);
    expect((await app.request('/uploads/../wecooked.db')).status).toBe(404);
  });

  it('refuses non-images and guests', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const bad = await member.upload('/api/uploads', new TextEncoder().encode('not an image'), 'notes.txt', 'text/plain');
    expect(bad.status).toBe(400);
    expect((await new Client(app).upload('/api/uploads', await bigPhoto())).status).toBe(401);
  });

  it('cleans up photos no recipe uses, after a day', async () => {
    const { app, db, config } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const used = (await member.upload('/api/uploads', await bigPhoto())).json.id;
    const unused = (await member.upload('/api/uploads', await bigPhoto())).json.id;
    await member.post('/api/recipes', recipeBody({ coverPhoto: used }));

    expect(await cleanOrphanUploads(db, config.dataDir)).toBe(0); // too new
    db.$client.prepare('update uploads set created_at = ?').run(Date.now() - 2 * 86_400_000);
    expect(await cleanOrphanUploads(db, config.dataDir)).toBe(1);
    expect(fs.existsSync(path.join(config.dataDir, 'uploads', `${unused}.webp`))).toBe(false);
    expect(fs.existsSync(path.join(config.dataDir, 'uploads', `${used}.webp`))).toBe(true);
  });

  it('refuses a cover photo id that was never uploaded', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    expect((await member.post('/api/recipes', recipeBody({ coverPhoto: 'doesNotExist123' }))).status).toBe(400);
  });
});

describe('filter groups and tags', () => {
  it('can be added, renamed and removed by members; removing a tag untags recipes', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const group = (await member.post('/api/tags/groups', { name: 'Method' })).json;
    expect((await member.post('/api/tags/groups', { name: 'method' })).status).toBe(409);
    const steamed = (await member.post('/api/tags', { groupId: group.id, name: 'Steamed' })).json;
    expect((await member.post('/api/tags', { groupId: group.id, name: 'STEAMED' })).status).toBe(409);
    expect((await member.patch(`/api/tags/${steamed.id}`, { name: 'Steaming' })).status).toBe(200);

    const { id } = (await member.post('/api/recipes', recipeBody({ tagIds: [steamed.id] }))).json;
    expect((await member.get(`/api/recipes/${id}`)).json.tags[0].name).toBe('Steaming');
    expect((await member.del(`/api/tags/groups/${group.id}`)).status).toBe(200);
    expect((await member.get(`/api/recipes/${id}`)).json.tags).toEqual([]);
  });
});

describe('link titles', () => {
  it('only looks up YouTube links', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    expect((await member.get('/api/link-preview?url=http://169.254.169.254/latest')).status).toBe(404);
    expect((await member.get('/api/link-preview?url=nonsense')).status).toBe(400);
  });
});
