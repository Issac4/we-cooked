import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  CollectionInput,
  CollectionRecipesInput,
  usernameKey as nameKey,
  type Collection,
  type CollectionRef,
  type CollectionColor,
} from '@wecooked/shared';
import type { Db } from '../db/index.js';
import { collections, recipeCollections, recipes } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { HttpError, humanOnly, parseBody, requireMember } from '../http.js';

export function listCollections(db: Db): Collection[] {
  return db
    .select({
      id: collections.id,
      name: collections.name,
      color: collections.color,
      description: collections.description,
      // Only recipes that are not in the Trash.
      recipeCount: sql<number>`count(${recipes.id})`,
    })
    .from(collections)
    .leftJoin(recipeCollections, eq(recipeCollections.collectionId, collections.id))
    .leftJoin(recipes, and(eq(recipes.id, recipeCollections.recipeId), isNull(recipes.deletedAt)))
    .groupBy(collections.id)
    .orderBy(sql`${collections.name} collate nocase`)
    .all()
    .map((c) => ({ ...c, color: c.color as CollectionColor, recipeCount: Number(c.recipeCount) }));
}

export function collectionsOf(db: Db, recipeId: number): CollectionRef[] {
  return db
    .select({ id: collections.id, name: collections.name, color: collections.color })
    .from(recipeCollections)
    .innerJoin(collections, eq(collections.id, recipeCollections.collectionId))
    .where(eq(recipeCollections.recipeId, recipeId))
    .orderBy(asc(collections.name))
    .all()
    .map((c) => ({ ...c, color: c.color as CollectionColor }));
}

/** Recipe ids in a collection (used by the recipe list filter). */
export function recipeIdsIn(db: Db, collectionId: number): number[] | null {
  if (!db.select({ id: collections.id }).from(collections).where(eq(collections.id, collectionId)).get()) return null;
  return db
    .select({ id: recipeCollections.recipeId })
    .from(recipeCollections)
    .where(eq(recipeCollections.collectionId, collectionId))
    .all()
    .map((r) => r.id);
}

/** Adds recipes to a collection; already-added ones are skipped. Returns how many were new. */
export function addToCollection(db: Db, collectionId: number, recipeIds: number[]): number {
  if (!db.select({ id: collections.id }).from(collections).where(eq(collections.id, collectionId)).get()) {
    throw new HttpError(404, 'Collection not found');
  }
  const ids = [...new Set(recipeIds)];
  const found = db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(inArray(recipes.id, ids), isNull(recipes.deletedAt)))
    .all();
  if (found.length !== ids.length) throw new HttpError(400, 'Some of those recipes no longer exist');
  const now = Date.now();
  let added = 0;
  db.transaction((tx) => {
    for (const id of ids) {
      added += tx.insert(recipeCollections).values({ recipeId: id, collectionId, addedAt: now }).onConflictDoNothing().run().changes;
    }
  });
  return added;
}

function findOne(db: Db, id: number): Collection {
  const found = listCollections(db).find((c) => c.id === id);
  if (!found) throw new HttpError(404, 'Collection not found');
  return found;
}

export function collectionRoutes() {
  const app = new Hono<AppEnv>();

  app.get('/', (c) => c.json(listCollections(c.var.db)));
  app.get('/:id{[0-9]+}', (c) => c.json(findOne(c.var.db, Number(c.req.param('id')))));

  app.post('/', requireMember, async (c) => {
    const input = await parseBody(c, CollectionInput);
    const db = c.var.db;
    if (db.select().from(collections).where(eq(collections.nameKey, nameKey(input.name))).get()) {
      throw new HttpError(409, 'There is already a collection with that name', { name: 'Already exists' });
    }
    const row = db
      .insert(collections)
      .values({ ...input, nameKey: nameKey(input.name), createdBy: c.var.user!.id, createdAt: Date.now() })
      .returning({ id: collections.id })
      .get();
    return c.json(findOne(db, row.id), 201);
  });

  app.patch('/:id{[0-9]+}', requireMember, async (c) => {
    const id = Number(c.req.param('id'));
    const input = await parseBody(c, CollectionInput);
    const db = c.var.db;
    if (db.select().from(collections).where(and(eq(collections.nameKey, nameKey(input.name)), ne(collections.id, id))).get()) {
      throw new HttpError(409, 'There is already a collection with that name', { name: 'Already exists' });
    }
    const changed = db
      .update(collections)
      .set({ ...input, nameKey: nameKey(input.name) })
      .where(eq(collections.id, id))
      .run().changes;
    if (!changed) throw new HttpError(404, 'Collection not found');
    return c.json(findOne(db, id));
  });

  /** Deletes the collection only; its recipes stay. */
  app.delete('/:id{[0-9]+}', humanOnly, (c) => {
    const removed = c.var.db.delete(collections).where(eq(collections.id, Number(c.req.param('id')))).run().changes;
    if (!removed) throw new HttpError(404, 'Collection not found');
    return c.json({ ok: true });
  });

  app.post('/:id{[0-9]+}/recipes', requireMember, async (c) => {
    const { recipeIds } = await parseBody(c, CollectionRecipesInput);
    const added = addToCollection(c.var.db, Number(c.req.param('id')), recipeIds);
    return c.json({ added });
  });

  app.delete('/:id{[0-9]+}/recipes/:recipeId{[0-9]+}', requireMember, (c) => {
    c.var.db
      .delete(recipeCollections)
      .where(and(eq(recipeCollections.collectionId, Number(c.req.param('id'))), eq(recipeCollections.recipeId, Number(c.req.param('recipeId')))))
      .run();
    return c.json({ ok: true });
  });

  return app;
}
