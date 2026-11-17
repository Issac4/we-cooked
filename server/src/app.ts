import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { secureHeaders } from 'hono/secure-headers';
import type { HealthResponse } from '@wecooked/shared';
import type { Config } from './config.js';
import type { Db } from './db/index.js';

export interface AppDeps {
  config: Config;
  db: Db;
}

export function createApp({ config, db }: AppDeps) {
  const app = new Hono();

  app.use(secureHeaders({ crossOriginEmbedderPolicy: false }));

  const api = new Hono();

  api.get('/health', (c) => {
    db.$client.prepare('select 1').get();
    const body: HealthResponse = { ok: true, version: config.version };
    return c.json(body);
  });

  // Must stay last: anything under /api that no route matched.
  api.all('*', (c) => c.json({ error: 'Not found' }, 404));

  app.route('/api', api);

  // Built web app: real files first, then index.html for any other page so the
  // client-side router can handle it.
  const indexFile = config.webDir ? path.join(config.webDir, 'index.html') : '';
  if (indexFile && fs.existsSync(indexFile)) {
    const root = path.relative(process.cwd(), config.webDir) || '.';
    app.use(
      '/assets/*',
      serveStatic({
        root,
        onFound: (_path, c) => {
          c.header('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    app.use('*', serveStatic({ root }));
    const indexHtml = fs.readFileSync(indexFile, 'utf8');
    app.get('*', (c, next) => {
      if (/^\/(api|mcp|uploads)(\/|$)/.test(c.req.path)) return next();
      c.header('Cache-Control', 'no-cache');
      return c.html(indexHtml);
    });
  }

  return app;
}
