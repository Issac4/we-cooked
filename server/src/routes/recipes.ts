import { Hono } from 'hono';
import { RECIPE_SORTS, RecipeInput, RecipeUpdate, type LinkPreview, type RecipeSort } from '@wecooked/shared';
import type { AppEnv } from '../env.js';
import { HttpError, parseBody, requireMember } from '../http.js';
import { recipeIdsIn } from './collections.js';
import {
  createRecipe,
  getRecipe,
  listRecipes,
  listTrash,
  markReviewed,
  restoreRecipe,
  trashRecipe,
  updateRecipe,
} from '../recipes/service.js';

function idParam(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Recipe not found');
  return id;
}

export function recipeRoutes() {
  const app = new Hono<AppEnv>();

  // Public: anyone can browse.
  app.get('/', (c) => {
    const sortParam = c.req.query('sort') ?? 'new';
    const sort = (RECIPE_SORTS as readonly string[]).includes(sortParam) ? (sortParam as RecipeSort) : 'new';
    const tagIds = (c.req.query('tags') ?? '')
      .split(',')
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    const collection = Number(c.req.query('collection') ?? 0);
    let recipeIds: number[] | undefined;
    if (collection) {
      const ids = recipeIdsIn(c.var.db, collection);
      if (!ids) throw new HttpError(404, 'Collection not found');
      recipeIds = ids;
    }
    return c.json(listRecipes(c.var.db, { q: c.req.query('q'), tagIds, sort, recipeIds }));
  });

  app.get('/:id{[0-9]+}', (c) => {
    const recipe = getRecipe(c.var.db, idParam(c.req.param('id')));
    if (!recipe) throw new HttpError(404, 'Recipe not found');
    return c.json(recipe);
  });

  // Members only from here.
  app.post('/', requireMember, async (c) => {
    const input = await parseBody(c, RecipeInput);
    return c.json(createRecipe(c.var.db, input, { userId: c.var.user!.id }), 201);
  });

  app.put('/:id{[0-9]+}', requireMember, async (c) => {
    const { baseUpdatedAt, ...input } = await parseBody(c, RecipeUpdate);
    const recipe = updateRecipe(c.var.db, idParam(c.req.param('id')), input, { userId: c.var.user!.id }, baseUpdatedAt);
    return c.json(recipe);
  });

  app.post('/:id{[0-9]+}/reviewed', requireMember, (c) => {
    markReviewed(c.var.db, idParam(c.req.param('id')));
    return c.json({ ok: true });
  });

  app.delete('/:id{[0-9]+}', requireMember, (c) => {
    trashRecipe(c.var.db, idParam(c.req.param('id')), { userId: c.var.user!.id });
    return c.json({ ok: true });
  });

  return app;
}

export function trashRoutes() {
  const app = new Hono<AppEnv>();
  app.use(requireMember);
  app.get('/', (c) => c.json(listTrash(c.var.db)));
  app.post('/:id{[0-9]+}/restore', (c) => {
    restoreRecipe(c.var.db, idParam(c.req.param('id')));
    return c.json({ ok: true });
  });
  return app;
}

/**
 * Title for a source link. Only YouTube (via its public oEmbed endpoint), so the
 * server never fetches arbitrary addresses on someone's behalf.
 */
export function linkPreviewRoutes() {
  const app = new Hono<AppEnv>();
  app.get('/', requireMember, async (c) => {
    const raw = c.req.query('url') ?? '';
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new HttpError(400, 'Not a link');
    }
    const host = url.hostname.replace(/^www\.|^m\./, '');
    if (!['youtube.com', 'youtu.be'].includes(host)) throw new HttpError(404, 'No preview for this site');
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.toString())}`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!res?.ok) throw new HttpError(404, 'Could not read the video title');
    const data = (await res.json()) as { title?: string; author_name?: string };
    const body: LinkPreview = { title: [data.title, data.author_name].filter(Boolean).join(' · ') };
    return c.json(body);
  });
  return app;
}
