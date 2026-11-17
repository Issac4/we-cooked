import { Hono } from 'hono';
import { randomToken } from '../auth/crypto.js';
import type { AppEnv } from '../env.js';
import { HttpError } from '../http.js';
import { setCoverPhoto, type Actor } from '../recipes/service.js';
import { photoBodyLimit, readPhotoField, saveImage } from '../routes/uploads.js';

const TTL_MS = 10 * 60 * 1000;

interface Drop {
  recipeId: number;
  actor: Actor;
  expiresAt: number;
}

/**
 * One-time upload links for AI agents: the agent asks for a link (via MCP) and
 * runs `curl -F file=@photo.jpg <link>`. The link sets that one recipe's photo,
 * works until it succeeds once, and expires after 10 minutes. In memory: a
 * restart simply cancels open links.
 */
const drops = new Map<string, Drop>();

export function createPhotoDrop(recipeId: number, actor: Actor): { token: string; expiresAt: number } {
  const now = Date.now();
  for (const [t, d] of drops) if (d.expiresAt <= now) drops.delete(t);
  const token = randomToken(24);
  const expiresAt = now + TTL_MS;
  drops.set(token, { recipeId, actor, expiresAt });
  return { token, expiresAt };
}

/** POST /api/photo-drop/:token (multipart, field "file"). The token is the only credential. */
export function photoDropRoutes() {
  const app = new Hono<AppEnv>();
  app.post('/:token', photoBodyLimit, async (c) => {
    const token = c.req.param('token');
    const drop = drops.get(token);
    if (!drop || drop.expiresAt <= Date.now()) {
      drops.delete(token);
      throw new HttpError(410, 'This upload link has expired or was already used. Ask for a new one.');
    }
    const upload = await saveImage(c.var.db, c.var.config.dataDir, await readPhotoField(c), drop.actor.userId);
    setCoverPhoto(c.var.db, drop.recipeId, upload.id, drop.actor);
    drops.delete(token);
    return c.json({ ok: true, message: 'Photo added to the recipe.', recipeId: drop.recipeId, width: upload.width, height: upload.height });
  });
  return app;
}
