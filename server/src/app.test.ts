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

describe('config', () => {
  it('refuses a short admin password in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', ADMIN_PASSWORD: 'short' })).toThrow(/ADMIN_PASSWORD/);
  });
});
