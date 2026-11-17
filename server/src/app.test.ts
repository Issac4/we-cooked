import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { HealthResponse } from '@wecooked/shared';
import { loadConfig } from './config.js';
import { openDb } from './db/index.js';
import { createApp } from './app.js';

const webDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wecooked-web-'));
fs.writeFileSync(path.join(webDir, 'index.html'), '<!doctype html><title>We Cooked</title>');

const config = loadConfig({ NODE_ENV: 'test', WEB_DIR: webDir, MIGRATIONS_DIR: 'drizzle' });
const db = openDb(':memory:', config.migrationsDir);
const app = createApp({ config, db });

afterAll(() => {
  db.$client.close();
  fs.rmSync(webDir, { recursive: true, force: true });
});

describe('server skeleton', () => {
  it('reports health', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(HealthResponse.parse(await res.json()).ok).toBe(true);
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('serves the web app for page routes', async () => {
    const res = await app.request('/plan');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('We Cooked');
  });

  it('creates the settings table through migrations', () => {
    const row = db.$client
      .prepare("select name from sqlite_master where type = 'table' and name = 'settings'")
      .get();
    expect(row).toBeTruthy();
  });
});

describe('share previews', () => {
  it('adds title and Open Graph tags to recipe pages, escaped', async () => {
    const { createMember, makeTestApp: make, recipeBody } = await import('./test/helpers.js');
    const t = make();
    // makeTestApp has no web build; give it one for this test.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wecooked-web-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><head><title>We Cooked</title></head><body></body></html>');
    const app2 = createApp({ config: { ...t.config, webDir: dir }, db: t.db });
    const { member } = await createMember(app2, 'Issac');
    const { id } = (await member.post('/api/recipes', recipeBody({ title: 'Mum\'s <Best> Chicken', otherName: '豉油雞' }))).json;
    const html = await (await app2.request(`/recipes/${id}`)).text();
    expect(html).toContain('<meta property="og:title" content="Mum&#39;s &lt;Best&gt; Chicken · 豉油雞" />');
    expect(html).toContain('<title>Mum&#39;s &lt;Best&gt; Chicken · 豉油雞 · We Cooked</title>');
    expect(html).toContain('45 min · serves 4');
    expect(html).not.toContain('<Best>');
    const other = await (await app2.request('/recipes/99999')).text();
    expect(other).toContain('<title>We Cooked</title>');
  });
});

describe('config', () => {
  it('refuses a short admin password in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', ADMIN_PASSWORD: 'short' })).toThrow(/ADMIN_PASSWORD/);
  });
});
