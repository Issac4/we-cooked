import { and, desc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { CommentInput, type Comment } from '@wecooked/shared';
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

export function addComment(db: Db, recipeId: number, authorId: number, body: string): Comment {
  const recipe = db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), isNull(recipes.deletedAt)))
    .get();
  if (!recipe) throw new HttpError(404, 'Recipe not found');
  const row = db.insert(comments).values({ recipeId, authorId, body, createdAt: Date.now() }).returning({ id: comments.id }).get();
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
    const { body } = await parseBody(c, CommentInput);
    return c.json(addComment(c.var.db, Number(c.req.param('id')), c.var.user!.id, body), 201);
  });
  return app;
}

/** Mounted under /api/comments. */
export function commentRoutes() {
  const app = new Hono<AppEnv>();
  app.use(requireMember);

  app.patch('/:id{[0-9]+}', async (c) => {
    const { body } = await parseBody(c, CommentInput);
    const row = ownComment(c.var.db, Number(c.req.param('id')), c.var.user!.id);
    c.var.db.update(comments).set({ body, editedAt: Date.now() }).where(eq(comments.id, row.id)).run();
    return c.json(listComments(c.var.db, row.recipeId, c.var.user!.id).find((x) => x.id === row.id));
  });

  app.delete('/:id{[0-9]+}', (c) => {
    const row = ownComment(c.var.db, Number(c.req.param('id')), c.var.user!.id);
    c.var.db.delete(comments).where(eq(comments.id, row.id)).run();
    return c.json({ ok: true });
  });

  return app;
}
