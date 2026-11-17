import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { ApiKeyCreate, type ApiKey, type ApiKeyCreated, type ApiKeyScope } from '@wecooked/shared';
import { createApiKey } from '../auth/api-keys.js';
import { apiKeys } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { HttpError, humanOnly, parseBody } from '../http.js';

const toApi = (r: typeof apiKeys.$inferSelect): ApiKey => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  scope: r.scope as ApiKeyScope,
  createdAt: r.createdAt,
  lastUsedAt: r.lastUsedAt,
});

/** A member's own API keys. Mounted at /api/me/keys; never usable with a key. */
export function keyRoutes() {
  const app = new Hono<AppEnv>();
  app.use(humanOnly);

  app.get('/', (c) =>
    c.json(c.var.db.select().from(apiKeys).where(eq(apiKeys.userId, c.var.user!.id)).orderBy(desc(apiKeys.createdAt)).all().map(toApi)),
  );

  app.post('/', async (c) => {
    const { name, scope } = await parseBody(c, ApiKeyCreate);
    const { key, row } = createApiKey(c.var.db, c.var.user!.id, name, scope);
    const body: ApiKeyCreated = { ...toApi(row), key };
    return c.json(body, 201);
  });

  app.delete('/:id{[0-9]+}', (c) => {
    const removed = c.var.db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, Number(c.req.param('id'))), eq(apiKeys.userId, c.var.user!.id)))
      .run().changes;
    if (!removed) throw new HttpError(404, 'Key not found');
    return c.json({ ok: true });
  });

  return app;
}
