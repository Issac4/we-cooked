import fs from 'node:fs/promises';
import path from 'node:path';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import sharp from 'sharp';
import type { Upload } from '@wecooked/shared';
import { randomToken } from '../auth/crypto.js';
import type { Db } from '../db/index.js';
import { recipes, uploads } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { HttpError, requireMember } from '../http.js';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const FULL_SIZE = 1600;
const THUMB_SIZE = 640;
const ACCEPTED = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'heif', 'tiff']);
const FILE_NAME = /^([A-Za-z0-9_-]{8,64})(-thumb)?\.webp$/;

export function uploadsDir(dataDir: string): string {
  return path.join(dataDir, 'uploads');
}

/** POST /api/uploads (multipart, field "file"). */
export function uploadRoutes() {
  const app = new Hono<AppEnv>();

  app.post(
    '/',
    requireMember,
    bodyLimit({
      maxSize: MAX_UPLOAD_BYTES + 64 * 1024,
      onError: () => {
        throw new HttpError(400, 'That photo is too large. The limit is 15 MB.');
      },
    }),
    async (c) => {
      const body = await c.req.parseBody();
      const file = body.file;
      if (!(file instanceof File)) throw new HttpError(400, 'Choose a photo to upload');
      if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(400, 'That photo is too large. The limit is 15 MB.');

      const input = Buffer.from(await file.arrayBuffer());
      let format: string | undefined;
      try {
        format = (await sharp(input).metadata()).format;
      } catch {
        format = undefined;
      }
      if (!format || !ACCEPTED.has(format)) {
        throw new HttpError(400, 'That file is not a photo we can read. Use JPEG, PNG, WebP or HEIC.');
      }

      const id = randomToken(12);
      const dir = uploadsDir(c.var.config.dataDir);
      await fs.mkdir(dir, { recursive: true });
      // .rotate() applies the camera orientation; metadata (GPS, camera) is not copied.
      const full = await sharp(input)
        .rotate()
        .resize({ width: FULL_SIZE, height: FULL_SIZE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      const thumb = await sharp(input)
        .rotate()
        .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();
      await fs.writeFile(path.join(dir, `${id}.webp`), full.data);
      await fs.writeFile(path.join(dir, `${id}-thumb.webp`), thumb);

      c.var.db
        .insert(uploads)
        .values({
          id,
          width: full.info.width,
          height: full.info.height,
          bytes: full.data.length + thumb.length,
          createdBy: c.var.user!.id,
          createdAt: Date.now(),
        })
        .run();
      const res: Upload = { id, width: full.info.width, height: full.info.height };
      return c.json(res, 201);
    },
  );

  return app;
}

/** GET /uploads/:file, served with a long cache because names never change. */
export function servePhotos(dataDir: string) {
  const app = new Hono();
  app.get('/:file', async (c) => {
    const name = c.req.param('file');
    if (!FILE_NAME.test(name)) return c.notFound();
    try {
      const data = await fs.readFile(path.join(uploadsDir(dataDir), name));
      return c.body(data, 200, {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
    } catch {
      return c.notFound();
    }
  });
  return app;
}

/** Deletes photos that no recipe uses, a day after upload (abandoned forms, replaced covers). */
export async function cleanOrphanUploads(db: Db, dataDir: string, olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = Date.now() - olderThanMs;
  const orphans = db
    .select({ id: uploads.id })
    .from(uploads)
    .leftJoin(recipes, eq(recipes.coverPhoto, uploads.id))
    .where(and(isNull(recipes.id), lt(uploads.createdAt, cutoff)))
    .all();
  const dir = uploadsDir(dataDir);
  for (const { id } of orphans) {
    db.delete(uploads).where(eq(uploads.id, id)).run();
    await fs.rm(path.join(dir, `${id}.webp`), { force: true });
    await fs.rm(path.join(dir, `${id}-thumb.webp`), { force: true });
  }
  return orphans.length;
}

export function uploadExists(db: Db, id: string): boolean {
  return !!db.select({ n: sql`1` }).from(uploads).where(eq(uploads.id, id)).get();
}
