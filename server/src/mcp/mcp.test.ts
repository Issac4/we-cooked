import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client as ApiClient, createMember, makeTestApp, recipeBody, type Client } from '../test/helpers.js';

type App = ReturnType<typeof makeTestApp>['app'];

async function newKey(member: Client, scope: 'read' | 'write' = 'write', name = 'Claude on laptop') {
  const res = await member.post('/api/me/keys', { name, scope });
  expect(res.status).toBe(201);
  return res.json.key as string;
}

/** The official MCP client, talking to the app in-process. */
async function connect(app: App, key: string) {
  const transport = new StreamableHTTPClientTransport(new URL('https://wecooked.test/mcp'), {
    fetch: async (url, init) => app.request(url.toString(), init as RequestInit),
    requestInit: { headers: { Authorization: `Bearer ${key}` } },
  });
  const client = new McpClient({ name: 'test-agent', version: '1.0.0' });
  await client.connect(transport);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: Array<{ text: string }> };
    const text = res.content[0]!.text;
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { isError: !!res.isError, text, json };
  };
  return { client, call };
}

const agentRecipe = (overrides: Record<string, unknown> = {}) => {
  const { coverPhoto: _c, ...body } = { ...recipeBody(), coverPhoto: null, ...overrides } as Record<string, unknown>;
  return body;
};

describe('API keys over REST', () => {
  it('act as the member; read-only keys and risky actions are refused', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const writeKey = await newKey(member);
    const readKey = await newKey(member, 'read', 'Reader');
    const bearer = (k: string) => ({ authorization: `Bearer ${k}` });
    // A client with no cookies: only the key signs it in.
    const asKey = (k: string, method: string, path: string, body?: unknown) => new ApiClient(app).request(method, path, body, bearer(k));

    const created = await asKey(writeKey, 'POST', '/api/recipes', recipeBody());
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ createdBy: 'Issac', needsReview: true, aiKeyName: 'Claude on laptop' });

    expect((await asKey(readKey, 'GET', `/api/recipes/${created.json.id}`)).status).toBe(200);
    expect((await asKey(readKey, 'POST', '/api/recipes', recipeBody())).status).toBe(403);
    expect((await asKey(writeKey, 'DELETE', `/api/recipes/${created.json.id}`)).status).toBe(403);
    expect((await asKey(writeKey, 'GET', '/api/me/keys')).status).toBe(403);
    expect((await asKey(writeKey, 'PATCH', '/api/me', { username: 'Hacker' })).status).toBe(403);
    expect((await asKey(writeKey, 'PATCH', '/api/settings', { aiRules: 'x' })).status).toBe(403);
    expect((await asKey('wc_not_a_real_key', 'GET', '/api/recipes')).status).toBe(401);

    // A member reviews it; the badge goes away.
    await member.post(`/api/recipes/${created.json.id}/reviewed`);
    expect((await member.get(`/api/recipes/${created.json.id}`)).json).toMatchObject({ needsReview: false, aiKeyName: null });

    // Revoking stops the key at once.
    const keys = (await member.get('/api/me/keys')).json;
    expect(keys.map((k: any) => k.name).sort()).toEqual(['Claude on laptop', 'Reader']);
    expect(keys.every((k: any) => !('key' in k))).toBe(true);
    await member.del(`/api/me/keys/${keys.find((k: any) => k.name === 'Claude on laptop').id}`);
    expect((await asKey(writeKey, 'GET', '/api/recipes')).status).toBe(401);
  });
});

describe('MCP', () => {
  it('refuses requests without a valid key', async () => {
    const { app } = makeTestApp();
    const res = await app.request('/mcp', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
  });

  it('sends the workflow and house rules on connect, and lists the tools', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    await member.patch('/api/settings', { aiRules: 'Titles in English, Chinese name as the other name.' });
    const { client, call } = await connect(app, await newKey(member));
    expect(client.getInstructions()).toMatch(/search_recipes first/);
    expect(client.getInstructions()).toMatch(/Titles in English/);
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'add_comment', 'add_plan_entry', 'add_to_collection', 'create_recipe', 'create_tag', 'get_guide',
      'get_meal_plan', 'get_photo_upload_link', 'get_recipe', 'list_collections', 'list_tags', 'search_recipes',
      'set_recipe_photo_from_url', 'update_recipe',
    ]);
    expect(names).not.toContain('delete_recipe');
    const guide = await call('get_guide');
    expect(guide.text).toMatch(/"section": "preparation"/);
    expect(guide.text).toMatch(/Titles in English/);
  });

  it('creates a recipe the household format way, refusing duplicates and made-up tags', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    await member.post('/api/recipes', recipeBody({ title: 'Steamed Egg with Minced Pork', otherName: '肉碎蒸水蛋' }));
    const { call } = await connect(app, await newKey(member));

    const groups = (await call('list_tags')).json;
    const egg = groups.flatMap((g: any) => g.tags).find((t: any) => t.name === 'Egg').id;

    const madeUp = await call('create_recipe', { recipe: agentRecipe({ title: 'Tomato Egg', tagIds: [9999] }) });
    expect(madeUp.isError).toBe(true);
    expect(madeUp.text).toMatch(/Unknown tag id\(s\): 9999/);
    expect(madeUp.text).toMatch(/Egg \(\d+\)/);

    const badSteps = await call('create_recipe', { recipe: agentRecipe({ title: 'Tomato Egg', steps: [{ section: 'frying', text: 'x' }] }) });
    expect(badSteps.isError).toBe(true);

    const dupe = await call('create_recipe', { recipe: agentRecipe({ title: 'Steamed egg with minced pork', otherName: '' }) });
    expect(dupe.isError).toBe(true);
    expect(dupe.text).toMatch(/Possible duplicates: "Steamed Egg with Minced Pork"/);

    const ok = await call('create_recipe', { recipe: agentRecipe({ title: 'Tomato and Egg Stir-fry', otherName: '番茄炒蛋', tagIds: [egg] }) });
    expect(ok.isError).toBe(false);
    const saved = (await member.get(`/api/recipes/${ok.json.id}`)).json;
    expect(saved).toMatchObject({ title: 'Tomato and Egg Stir-fry', needsReview: true, aiKeyName: 'Claude on laptop', createdBy: 'Issac' });
    expect(saved.tags.map((t: any) => t.name)).toEqual(['Egg']);

    const forced = await call('create_recipe', { recipe: agentRecipe({ title: 'Steamed Egg', otherName: '' }), confirmNew: true });
    expect(forced.isError).toBe(false);

    const found = (await call('search_recipes', { query: '番茄' })).json;
    expect(found.recipes.map((r: any) => r.title)).toEqual(['Tomato and Egg Stir-fry']);
  });

  it('creates tags only when not a near-duplicate', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const { call } = await connect(app, await newKey(member));
    const protein = (await call('list_tags')).json.find((g: any) => g.name === 'Protein').id;
    expect((await call('create_tag', { groupId: protein, name: 'chicken' })).json.message).toMatch(/Already exists/);
    const near = await call('create_tag', { groupId: protein, name: 'Chickens' });
    expect(near.isError).toBe(true);
    expect(near.text).toMatch(/Similar tags already exist: Chicken/);
    expect((await call('create_tag', { groupId: protein, name: 'Goose' })).json.name).toBe('Goose');
  });

  it('read-only keys can look but not change', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const { call } = await connect(app, await newKey(member, 'read'));
    expect((await call('search_recipes', {})).isError).toBe(false);
    const res = await call('create_recipe', { recipe: agentRecipe() });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/read-only/);
  });

  it('adds comments, collection members and plan entries as the member', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const recipe = (await member.post('/api/recipes', recipeBody())).json;
    const col = (await member.post('/api/collections', { name: 'Weeknight' })).json;
    const { call } = await connect(app, await newKey(member));

    expect((await call('add_comment', { recipeId: recipe.id, body: 'Try less sugar.' })).json.author).toBe('Issac');
    expect((await call('add_comment', { recipeId: recipe.id, body: 'Loved it', rating: 5 })).json).toMatchObject({ rating: 5 });
    expect((await call('add_comment', { recipeId: recipe.id })).text).toMatch(/note, a rating, or both/);
    expect((await call('get_recipe', { id: recipe.id })).json.rating).toMatchObject({ average: 5, count: 1 });
    expect((await call('add_to_collection', { collectionId: col.id, recipeIds: [recipe.id] })).json.added).toBe(1);
    expect((await call('add_plan_entry', { dates: ['2026-11-18'], row: 'dinner', recipeId: recipe.id })).json.added).toBe(1);
    expect((await call('add_plan_entry', { dates: ['2026-11-18'], row: 'Supper', text: 'x' })).text).toMatch(/Rows: Breakfast, Lunch, Dinner/);
    const plan = (await call('get_meal_plan', { from: '2026-11-16', to: '2026-11-22' })).json;
    expect(plan.entries[0]).toMatchObject({ label: 'Soy Sauce Chicken', date: '2026-11-18' });
  });

  it('updates a recipe but keeps its photo', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const recipe = (await member.post('/api/recipes', recipeBody())).json;
    const { call } = await connect(app, await newKey(member));
    const res = await call('update_recipe', { id: recipe.id, recipe: agentRecipe({ title: 'Soy Sauce Chicken (less sugar)' }) });
    expect(res.isError).toBe(false);
    const saved = (await member.get(`/api/recipes/${recipe.id}`)).json;
    expect(saved).toMatchObject({ title: 'Soy Sauce Chicken (less sugar)', needsReview: true, updatedBy: 'Issac' });
  });

  it('lists the photo tools', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const { client } = await connect(app, await newKey(member));
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['set_recipe_photo_from_url', 'get_photo_upload_link']));
  });

  it('uploads a local photo through a one-time link, once', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const recipe = (await member.post('/api/recipes', recipeBody())).json;
    const { call } = await connect(app, await newKey(member));

    const res = await call('get_photo_upload_link', { recipeId: recipe.id });
    expect(res.isError).toBe(false);
    const link = res.json.command.match(/(https:\/\/wecooked\.test\/api\/photo-drop\/\S+)/)[1] as string;
    expect(res.json.command).toMatch(/^curl -fsS -F "file=@\/path\/to\/photo\.jpg" https:/);

    const photo = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#c86' } }).jpeg().toBuffer();
    const send = (data: Uint8Array) => {
      const form = new FormData();
      form.set('file', new File([new Uint8Array(data)], 'photo.jpg', { type: 'image/jpeg' }));
      return app.request(link, { method: 'POST', body: form });
    };
    // A wrong file does not use up the link.
    expect((await send(new TextEncoder().encode('not a photo'))).status).toBe(400);
    const ok = await send(photo);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, recipeId: recipe.id, width: 1600 });
    expect((await send(photo)).status).toBe(410);

    const saved = (await member.get(`/api/recipes/${recipe.id}`)).json;
    expect(saved.coverPhoto).toBeTruthy();
    expect(saved).toMatchObject({ needsReview: true, aiKeyName: 'Claude on laptop' });
    expect((await app.request(`/uploads/${saved.coverPhoto}.webp`)).status).toBe(200);
  });

  it('refuses photo links to private addresses, unknown recipes and read-only keys', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    const recipe = (await member.post('/api/recipes', recipeBody())).json;
    const { call } = await connect(app, await newKey(member));
    const local = await call('set_recipe_photo_from_url', { recipeId: recipe.id, url: 'http://192.168.2.108/photo.jpg' });
    expect(local.isError).toBe(true);
    expect(local.text).toMatch(/private or local address/);
    expect((await call('get_photo_upload_link', { recipeId: 9999 })).text).toMatch(/Recipe not found/);

    const reader = await connect(app, await newKey(member, 'read', 'Reader'));
    expect((await reader.call('get_photo_upload_link', { recipeId: recipe.id })).text).toMatch(/read-only/);
    expect((await reader.call('set_recipe_photo_from_url', { recipeId: recipe.id, url: 'https://example.com/a.jpg' })).text).toMatch(/read-only/);
  });

  it('refuses an unknown upload link', async () => {
    const { app } = makeTestApp();
    const form = new FormData();
    form.set('file', new File([new Uint8Array([1, 2, 3])], 'x.jpg'));
    expect((await app.request('/api/photo-drop/not-a-real-token', { method: 'POST', body: form })).status).toBe(410);
  });
});

