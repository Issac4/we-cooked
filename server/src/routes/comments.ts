import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { CommentInput, type Comment, type RatingSummary } from '@wecooked/shared';
import type { Db } from '../db/index.js';
import { comments, recipes, users } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { HttpError, parseBody, requireMember } from '../http.js';

export function listComments(db: Db, recipeId: number, viewerId: number | null): Comment[] {
  return db
    .select({
      id: comments.id,
      recipeId: comments.recipeId,
      authorId: comments.authorId,
      author: users.username,
      body: comments.body,
      rating: comments.rating,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.recipeId, recipeId))
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .all()
    .map(({ authorId, ...c }) => ({ ...c, mine: viewerId !== null && authorId === viewerId }));
}

/**
 * Household rating per recipe: each member's most recent rating counts once, so someone
 * who rates a dish every time they cook it doesn't outweigh everyone else.
 */
export function ratingsFor(db: Db, recipeIds: number[]): Map<number, RatingSummary> {
  const out = new Map<number, RatingSummary>();
  if (!recipeIds.length) return out;
  const rows = db
    .select({ recipeId: comments.recipeId, authorId: comments.authorId, name: users.username, rating: comments.rating })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(and(inArray(comments.recipeId, recipeIds), isNotNull(comments.rating)))
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .all();
  const seen = new Set<string>();
  const people = new Map<number, { name: string; rating: number }[]>();
  for (const r of rows) {
    const key = `${r.recipeId}:${r.authorId}`;
    if (seen.has(key)) continue; // an older rating by the same member
    seen.add(key);
    people.set(r.recipeId, [...(people.get(r.recipeId) ?? []), { name: r.name, rating: r.rating! }]);
  }
  for (const [recipeId, list] of people) {
    list.sort((a, b) => a.name.localeCompare(b.name));
    const average = Math.round((list.reduce((sum, p) => sum + p.rating, 0) / list.length) * 10) / 10;
    out.set(recipeId, { average, count: list.length, people: list });
  }
  return out;
}

export function addComment(db: Db, recipeId: number, authorId: number, input: CommentInput): Comment {
  const recipe = db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), isNull(recipes.deletedAt)))
    .get();
  if (!recipe) throw new HttpError(404, 'Recipe not found');
  const { body, rating } = CommentInput.parse(input);
  const row = db.insert(comments).values({ recipeId, authorId, body, rating, createdAt: Date.now() }).returning({ id: comments.id }).get();
  return listComments(db, recipeId, authorId).find((c) => c.id === row.id)!;
}

/** The comment, if the signed-in member wrote it. */
function ownComment(db: Db, id: number, userId: number) {
  const row = db.select().from(comments).where(eq(comments.id, id)).get();
  if (!row) throw new HttpError(404, 'Note not found');
  if (row.authorId !== userId) throw new HttpError(403, 'You can only change your own notes');
  return row;
}

/** Mounted under /api/recipes/:id/comments. */
export function recipeCommentRoutes() {
  const app = new Hono<AppEnv>();
  app.get('/', (c) => c.json(listComments(c.var.db, Number(c.req.param('id')), c.var.user?.id ?? null)));
  app.post('/', requireMember, async (c) => {
    const input = await parseBody(c, CommentInput);
    return c.json(addComment(c.var.db, Number(c.req.param('id')), c.var.user!.id, input), 201);
  });
  return app;
}

/** Mounted under /api/comments. */
export function commentRoutes() {
  const app = new Hono<AppEnv>();
  app.use(requireMember);

  app.patch('/:id{[0-9]+}', async (c) => {
    const { body, rating } = await parseBody(c, CommentInput);
    const row = ownComment(c.var.db, Number(c.req.param('id')), c.var.user!.id);
    c.var.db.update(comments).set({ body, rating, editedAt: Date.now() }).where(eq(comments.id, row.id)).run();
    return c.json(listComments(c.var.db, row.recipeId, c.var.user!.id).find((x) => x.id === row.id));
  });

  app.delete('/:id{[0-9]+}', (c) => {
    const row = ownComment(c.var.db, Number(c.req.param('id')), c.var.user!.id);
    c.var.db.delete(comments).where(eq(comments.id, row.id)).run();
    return c.json({ ok: true });
  });

  return app;
}
