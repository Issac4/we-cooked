import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import {
  TRASH_DAYS,
  type Recipe,
  type RecipeCard,
  type RecipeInput,
  type RecipeList,
  type RecipeSort,
  type Tag,
  type TrashItem,
} from '@wecooked/shared';
import type { Db } from '../db/index.js';
import { recipes, recipeTags, tagGroups, tags, uploads, users } from '../db/schema.js';
import { HttpError } from '../http.js';
import { collectionsOf } from '../routes/collections.js';

const DAY = 24 * 60 * 60 * 1000;

/** Who is making a change: a member, or (later) an AI agent using a member's API key. */
export interface Actor {
  userId: number;
  viaApiKey?: boolean;
}

export interface ListOptions {
  q?: string;
  tagIds?: number[];
  sort?: RecipeSort;
  recipeIds?: number[];
}

function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

function tagsFor(db: Db, ids: number[]): Map<number, Tag[]> {
  const map = new Map<number, Tag[]>();
  if (!ids.length) return map;
  const rows = db
    .select({ recipeId: recipeTags.recipeId, id: tags.id, groupId: tags.groupId, name: tags.name })
    .from(recipeTags)
    .innerJoin(tags, eq(tags.id, recipeTags.tagId))
    .innerJoin(tagGroups, eq(tagGroups.id, tags.groupId))
    .where(inArray(recipeTags.recipeId, ids))
    .orderBy(asc(tagGroups.position), asc(tags.position))
    .all();
  for (const r of rows) {
    const list = map.get(r.recipeId) ?? [];
    list.push({ id: r.id, groupId: r.groupId, name: r.name });
    map.set(r.recipeId, list);
  }
  return map;
}

const cardColumns = {
  id: recipes.id,
  title: recipes.title,
  otherName: recipes.otherName,
  coverPhoto: recipes.coverPhoto,
  servings: recipes.servings,
  prepMins: recipes.prepMins,
  cookMins: recipes.cookMins,
  needsReview: recipes.needsReview,
  createdAt: recipes.createdAt,
  updatedAt: recipes.updatedAt,
};

export function listRecipes(db: Db, opts: ListOptions = {}): RecipeList {
  const where: SQL[] = [isNull(recipes.deletedAt)];
  const q = opts.q?.trim();
  if (q) {
    const p = likePattern(q);
    where.push(
      sql`(${recipes.title} like ${p} escape '\\' or ${recipes.otherName} like ${p} escape '\\' or ${recipes.ingredients} like ${p} escape '\\')`,
    );
  }
  const tagIds = [...new Set(opts.tagIds ?? [])];
  if (tagIds.length) {
    // Recipes that have every selected tag.
    where.push(
      sql`${recipes.id} in (select ${recipeTags.recipeId} from ${recipeTags} where ${inArray(recipeTags.tagId, tagIds)} group by ${recipeTags.recipeId} having count(*) = ${tagIds.length})`,
    );
  }
  if (opts.recipeIds) where.push(opts.recipeIds.length ? inArray(recipes.id, opts.recipeIds) : sql`0`);

  const order =
    opts.sort === 'title'
      ? [sql`${recipes.title} collate nocase`]
      : opts.sort === 'time'
        ? [sql`(coalesce(${recipes.prepMins}, 0) + coalesce(${recipes.cookMins}, 0)) = 0`, sql`coalesce(${recipes.prepMins}, 0) + coalesce(${recipes.cookMins}, 0)`]
        : opts.sort === 'updated'
          ? [desc(recipes.updatedAt)]
          : [desc(recipes.createdAt), desc(recipes.id)];

  const rows = db.select(cardColumns).from(recipes).where(and(...where)).orderBy(...order).all();
  const tagMap = tagsFor(
    db,
    rows.map((r) => r.id),
  );
  const cards: RecipeCard[] = rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
  return { recipes: cards, total: cards.length };
}

export function getRecipe(db: Db, id: number, { includeDeleted = false } = {}): Recipe | null {
  const creator = alias(users, 'creator');
  const editor = alias(users, 'editor');
  const row = db
    .select({
      ...cardColumns,
      description: recipes.description,
      ingredients: recipes.ingredients,
      steps: recipes.steps,
      links: recipes.links,
      deletedAt: recipes.deletedAt,
      createdBy: creator.username,
      updatedBy: editor.username,
    })
    .from(recipes)
    .leftJoin(creator, eq(creator.id, recipes.createdBy))
    .leftJoin(editor, eq(editor.id, recipes.updatedBy))
    .where(eq(recipes.id, id))
    .get();
  if (!row || (row.deletedAt && !includeDeleted)) return null;
  const { deletedAt: _deleted, ...rest } = row;
  return { ...rest, tags: tagsFor(db, [id]).get(id) ?? [], collections: collectionsOf(db, id) };
}

/** Rejects unknown tag ids with the list of valid ones, so a form or an AI agent can correct itself. */
function checkReferences(db: Db, input: RecipeInput) {
  const tagIds = [...new Set(input.tagIds)];
  if (tagIds.length) {
    const found = db.select({ id: tags.id }).from(tags).where(inArray(tags.id, tagIds)).all();
    if (found.length !== tagIds.length) {
      const known = new Set(found.map((t) => t.id));
      const missing = tagIds.filter((id) => !known.has(id));
      throw new HttpError(400, `Unknown tag id(s): ${missing.join(', ')}. Use GET /api/tags for the valid ones.`, {
        tagIds: 'Some tags no longer exist',
      });
    }
  }
  if (input.coverPhoto && !db.select({ id: uploads.id }).from(uploads).where(eq(uploads.id, input.coverPhoto)).get()) {
    throw new HttpError(400, 'That photo was not found. Upload it again.', { coverPhoto: 'Photo not found' });
  }
  return tagIds;
}

function values(input: RecipeInput) {
  return {
    title: input.title,
    otherName: input.otherName,
    description: input.description,
    coverPhoto: input.coverPhoto,
    servings: input.servings,
    prepMins: input.prepMins,
    cookMins: input.cookMins,
    // Drop empty ingredient sections so the page never shows a lonely heading.
    ingredients: input.ingredients.filter((s) => s.items.length > 0),
    steps: input.steps,
    links: input.links,
  };
}

export function createRecipe(db: Db, input: RecipeInput, actor: Actor): Recipe {
  const tagIds = checkReferences(db, input);
  const now = Date.now();
  const id = db.transaction((tx) => {
    const row = tx
      .insert(recipes)
      .values({
        ...values(input),
        needsReview: !!actor.viaApiKey,
        createdBy: actor.userId,
        createdAt: now,
        updatedBy: actor.userId,
        updatedAt: now,
      })
      .returning({ id: recipes.id })
      .get();
    for (const tagId of tagIds) tx.insert(recipeTags).values({ recipeId: row.id, tagId }).run();
    return row.id;
  });
  return getRecipe(db, id)!;
}

export function updateRecipe(db: Db, id: number, input: RecipeInput, actor: Actor, baseUpdatedAt?: number): Recipe {
  const tagIds = checkReferences(db, input);
  db.transaction((tx) => {
    const current = tx
      .select({ updatedAt: recipes.updatedAt, deletedAt: recipes.deletedAt, needsReview: recipes.needsReview })
      .from(recipes)
      .where(eq(recipes.id, id))
      .get();
    if (!current || current.deletedAt) throw new HttpError(404, 'Recipe not found');
    if (baseUpdatedAt !== undefined && current.updatedAt !== baseUpdatedAt) {
      throw new HttpError(
        409,
        'Someone else saved this recipe while you were editing. Your changes are kept on this page; reload to see theirs.',
      );
    }
    tx.update(recipes)
      .set({
        ...values(input),
        needsReview: actor.viaApiKey ? true : current.needsReview,
        updatedBy: actor.userId,
        // Strictly increasing, so two saves in the same millisecond still conflict.
        updatedAt: Math.max(Date.now(), current.updatedAt + 1),
      })
      .where(eq(recipes.id, id))
      .run();
    tx.delete(recipeTags).where(eq(recipeTags.recipeId, id)).run();
    for (const tagId of tagIds) tx.insert(recipeTags).values({ recipeId: id, tagId }).run();
  });
  return getRecipe(db, id)!;
}

export function markReviewed(db: Db, id: number): void {
  const changed = db
    .update(recipes)
    .set({ needsReview: false })
    .where(and(eq(recipes.id, id), isNull(recipes.deletedAt)))
    .run().changes;
  if (!changed) throw new HttpError(404, 'Recipe not found');
}

export function trashRecipe(db: Db, id: number, actor: Actor): void {
  const changed = db
    .update(recipes)
    .set({ deletedAt: Date.now(), deletedBy: actor.userId })
    .where(and(eq(recipes.id, id), isNull(recipes.deletedAt)))
    .run().changes;
  if (!changed) throw new HttpError(404, 'Recipe not found');
}

export function restoreRecipe(db: Db, id: number): void {
  const changed = db
    .update(recipes)
    .set({ deletedAt: null, deletedBy: null })
    .where(and(eq(recipes.id, id), isNotNull(recipes.deletedAt)))
    .run().changes;
  if (!changed) throw new HttpError(404, 'That recipe is not in the Trash');
}

export function listTrash(db: Db): TrashItem[] {
  const deleter = alias(users, 'deleter');
  return db
    .select({
      id: recipes.id,
      title: recipes.title,
      coverPhoto: recipes.coverPhoto,
      deletedAt: recipes.deletedAt,
      deletedBy: deleter.username,
    })
    .from(recipes)
    .leftJoin(deleter, eq(deleter.id, recipes.deletedBy))
    .where(isNotNull(recipes.deletedAt))
    .orderBy(desc(recipes.deletedAt))
    .all()
    .map((r) => ({ ...r, deletedAt: r.deletedAt!, purgeAt: r.deletedAt! + TRASH_DAYS * DAY }));
}

/** Permanently removes recipes that have been in the Trash for 30 days. */
export function purgeTrash(db: Db): number {
  return db
    .delete(recipes)
    .where(lt(recipes.deletedAt, Date.now() - TRASH_DAYS * DAY))
    .run().changes;
}
