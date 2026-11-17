import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { secureHeaders } from 'hono/secure-headers';
import type { HealthResponse } from '@wecooked/shared';
import type { Config } from './config.js';
import type { Db } from './db/index.js';
import type { AppEnv } from './env.js';
import { errorResponse, HttpError, loadSession, sameOrigin } from './http.js';
import { adminRoutes } from './routes/admin.js';
import { collectionRoutes } from './routes/collections.js';
import { commentRoutes, recipeCommentRoutes } from './routes/comments.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { linkPreviewRoutes, recipeRoutes, trashRoutes } from './routes/recipes.js';
import { tagRoutes } from './routes/tags.js';
import { servePhotos, uploadRoutes } from './routes/uploads.js';

export interface AppDeps {
  config: Config;
  db: Db;
}

export function createApp({ config, db }: AppDeps) {
  const app = new Hono<AppEnv>();

  app.use(secureHeaders({ crossOriginEmbedderPolicy: false }));
  app.use(async (c, next) => {
    c.set('config', config);
    c.set('db', db);
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return errorResponse(c, err);
    console.error(err);
    return c.json({ error: 'Something went wrong on the server' }, 500);
  });

  const api = new Hono<AppEnv>();
  api.use(sameOrigin, loadSession);

  api.get('/health', (c) => {
    db.$client.prepare('select 1').get();
    const body: HealthResponse = { ok: true, version: config.version };
    return c.json(body);
  });

  api.route('/auth', authRoutes());
  api.route('/me', meRoutes());
  api.route('/admin', adminRoutes());
  api.route('/tags', tagRoutes());
  api.route('/recipes/:id{[0-9]+}/comments', recipeCommentRoutes());
  api.route('/recipes', recipeRoutes());
  api.route('/comments', commentRoutes());
  api.route('/trash', trashRoutes());
  api.route('/collections', collectionRoutes());
  api.route('/uploads', uploadRoutes());
  api.route('/link-preview', linkPreviewRoutes());

  // Must stay last: anything under /api that no route matched.
  api.all('*', (c) => c.json({ error: 'Not found' }, 404));

  app.route('/api', api);
  app.route('/uploads', servePhotos(config.dataDir));

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
