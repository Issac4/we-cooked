import { and, asc, eq, max, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { RenameInput, TagGroupInput, TagInput, usernameKey as nameKey, type TagGroup } from '@wecooked/shared';
import type { Db } from '../db/index.js';
import { settings, tagGroups, tags } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { HttpError, humanOnly, parseBody, requireMember } from '../http.js';

const DEFAULT_GROUPS: Array<[string, string[]]> = [
  [
    'Protein',
    ['Beef', 'Cheese', 'Chicken', 'Clam', 'Crab', 'Duck', 'Egg', 'Fish', 'Lamb', 'Lobster', 'Milk', 'Mushrooms', 'Mussel', 'Oyster', 'Pork', 'Scallop', 'Seafood', 'Shrimp', 'Tofu', 'Vegetarian'],
  ],
  ['Meal', ['Appetizer', 'Beverage', 'Breakfast', 'Brunch', 'Dessert', 'Dinner', 'Lunch', 'Snack', 'Soup']],
  ['Cuisine', ['Cantonese', 'Chinese', 'Japanese', 'Korean', 'Southeast Asian', 'Western']],
];

/** Creates the starter filter groups once, on a brand-new database. */
export function seedDefaultTags(db: Db): void {
  if (db.select().from(settings).where(eq(settings.key, 'seeded_tags')).get()) return;
  db.transaction((tx) => {
    DEFAULT_GROUPS.forEach(([group, names], gi) => {
      const g = tx.insert(tagGroups).values({ name: group, nameKey: nameKey(group), position: gi }).returning().get();
      names.forEach((name, ti) => {
        tx.insert(tags).values({ groupId: g.id, name, nameKey: nameKey(name), position: ti }).run();
      });
    });
    tx.insert(settings).values({ key: 'seeded_tags', value: true }).run();
  });
}

export function listTagGroups(db: Db): TagGroup[] {
  const groups = db.select().from(tagGroups).orderBy(asc(tagGroups.position), asc(tagGroups.id)).all();
  const all = db.select().from(tags).orderBy(asc(tags.position), asc(tags.id)).all();
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    tags: all.filter((t) => t.groupId === g.id).map((t) => ({ id: t.id, groupId: t.groupId, name: t.name })),
  }));
}

export function tagRoutes() {
  const app = new Hono<AppEnv>();

  app.get('/', (c) => c.json(listTagGroups(c.var.db)));

  app.post('/groups', requireMember, async (c) => {
    const { name } = await parseBody(c, TagGroupInput);
    const db = c.var.db;
    if (db.select().from(tagGroups).where(eq(tagGroups.nameKey, nameKey(name))).get()) {
      throw new HttpError(409, 'There is already a group with that name', { name: 'Already exists' });
    }
    const position = (db.select({ m: max(tagGroups.position) }).from(tagGroups).get()?.m ?? -1) + 1;
    const g = db.insert(tagGroups).values({ name, nameKey: nameKey(name), position }).returning().get();
    return c.json({ id: g.id, name: g.name, tags: [] } satisfies TagGroup, 201);
  });

  app.patch('/groups/:id', requireMember, async (c) => {
    const id = Number(c.req.param('id'));
    const { name } = await parseBody(c, RenameInput);
    const db = c.var.db;
    if (db.select().from(tagGroups).where(and(eq(tagGroups.nameKey, nameKey(name)), ne(tagGroups.id, id))).get()) {
      throw new HttpError(409, 'There is already a group with that name', { name: 'Already exists' });
    }
    const changed = db.update(tagGroups).set({ name, nameKey: nameKey(name) }).where(eq(tagGroups.id, id)).run().changes;
    if (!changed) throw new HttpError(404, 'Group not found');
    return c.json({ ok: true });
  });

  app.delete('/groups/:id', humanOnly, (c) => {
    const removed = c.var.db.delete(tagGroups).where(eq(tagGroups.id, Number(c.req.param('id')))).run().changes;
    if (!removed) throw new HttpError(404, 'Group not found');
    return c.json({ ok: true });
  });

  app.post('/', requireMember, async (c) => {
    const { groupId, name } = await parseBody(c, TagInput);
    const db = c.var.db;
    if (!db.select().from(tagGroups).where(eq(tagGroups.id, groupId)).get()) throw new HttpError(404, 'Group not found');
    const existing = db
      .select()
      .from(tags)
      .where(and(eq(tags.groupId, groupId), eq(tags.nameKey, nameKey(name))))
      .get();
    if (existing) {
      throw new HttpError(409, `“${existing.name}” already exists in this group`, { name: 'Already exists' });
    }
    const position = (db.select({ m: max(tags.position) }).from(tags).where(eq(tags.groupId, groupId)).get()?.m ?? -1) + 1;
    const t = db.insert(tags).values({ groupId, name, nameKey: nameKey(name), position }).returning().get();
    return c.json({ id: t.id, groupId: t.groupId, name: t.name }, 201);
  });

  app.patch('/:id', requireMember, async (c) => {
    const id = Number(c.req.param('id'));
    const { name } = await parseBody(c, RenameInput);
    const db = c.var.db;
    const tag = db.select().from(tags).where(eq(tags.id, id)).get();
    if (!tag) throw new HttpError(404, 'Tag not found');
    const clash = db
      .select()
      .from(tags)
      .where(and(eq(tags.groupId, tag.groupId), eq(tags.nameKey, nameKey(name)), ne(tags.id, id)))
      .get();
    if (clash) throw new HttpError(409, 'That name is already used in this group', { name: 'Already exists' });
    db.update(tags).set({ name, nameKey: nameKey(name) }).where(eq(tags.id, id)).run();
    return c.json({ ok: true });
  });

  app.delete('/:id', humanOnly, (c) => {
    const removed = c.var.db.delete(tags).where(eq(tags.id, Number(c.req.param('id')))).run().changes;
    if (!removed) throw new HttpError(404, 'Tag not found');
    return c.json({ ok: true });
  });

  return app;
}
