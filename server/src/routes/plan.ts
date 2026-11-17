import { and, asc, desc, eq, gte, isNull, lte, max, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  AddEntries,
  addDays,
  CopyWeek,
  EventInput,
  IsoDate,
  MoveEntry,
  RowInput,
  RowOrder,
  toTime,
  type PlanEntry,
  type PlanEvent,
  type PlanView,
  type RecentItem,
  type RecipeHistory,
} from '@wecooked/shared';
import type { Db } from '../db/index.js';
import { planEntries, planEvents, planRows, recipes, settings } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { HttpError, parseBody, requireMember } from '../http.js';
import { getSettings, holidaysBetween } from './settings.js';

const MAX_RANGE_DAYS = 62;

export function seedDefaultRows(db: Db): void {
  if (db.select().from(settings).where(eq(settings.key, 'seeded_rows')).get()) return;
  db.transaction((tx) => {
    ['Breakfast', 'Lunch', 'Dinner'].forEach((name, position) => tx.insert(planRows).values({ name, position }).run());
    tx.insert(settings).values({ key: 'seeded_rows', value: true }).run();
  });
}

function checkRange(from: string | undefined, to: string | undefined): { from: string; to: string } {
  const f = IsoDate.safeParse(from);
  const t = IsoDate.safeParse(to);
  if (!f.success || !t.success) throw new HttpError(400, 'Use from and to as YYYY-MM-DD');
  const days = (toTime(t.data) - toTime(f.data)) / 86_400_000;
  if (days < 0 || days > MAX_RANGE_DAYS) throw new HttpError(400, `Ask for at most ${MAX_RANGE_DAYS} days at a time`);
  return { from: f.data, to: t.data };
}

/** Entries with the recipe's current title; a trashed recipe shows as plain text. */
export function entriesBetween(db: Db, from: string, to: string): PlanEntry[] {
  return db
    .select({
      id: planEntries.id,
      date: planEntries.date,
      rowId: planEntries.rowId,
      position: planEntries.position,
      recipeId: sql<number | null>`case when ${recipes.deletedAt} is null then ${recipes.id} end`,
      label: sql<string>`coalesce(case when ${recipes.deletedAt} is null then ${recipes.title} end, ${planEntries.label})`,
    })
    .from(planEntries)
    .leftJoin(recipes, eq(recipes.id, planEntries.recipeId))
    .where(and(gte(planEntries.date, from), lte(planEntries.date, to)))
    .orderBy(asc(planEntries.date), asc(planEntries.position), asc(planEntries.id))
    .all();
}

function eventsBetween(db: Db, from: string, to: string): PlanEvent[] {
  return db
    .select({ id: planEvents.id, name: planEvents.name, from: planEvents.fromDate, to: planEvents.toDate, away: planEvents.away })
    .from(planEvents)
    .where(and(lte(planEvents.fromDate, to), gte(planEvents.toDate, from)))
    .orderBy(asc(planEvents.fromDate), asc(planEvents.id))
    .all();
}

export function planView(db: Db, from: string, to: string): PlanView {
  const s = getSettings(db);
  return {
    from,
    to,
    rows: db.select().from(planRows).orderBy(asc(planRows.position), asc(planRows.id)).all(),
    entries: entriesBetween(db, from, to),
    events: eventsBetween(db, from, to),
    holidays: holidaysBetween(s, from, to),
    weekStart: s.weekStart,
  };
}

function nextPosition(db: Db | Parameters<Parameters<Db['transaction']>[0]>[0], date: string, rowId: number): number {
  const m = db
    .select({ m: max(planEntries.position) })
    .from(planEntries)
    .where(and(eq(planEntries.date, date), eq(planEntries.rowId, rowId)))
    .get()?.m;
  return (m ?? -1) + 1;
}

function requireRow(db: Db, rowId: number) {
  if (!db.select({ id: planRows.id }).from(planRows).where(eq(planRows.id, rowId)).get()) throw new HttpError(404, 'That row no longer exists');
}

/** Adds the same recipe or text to one or more days in a row. */
export function addEntries(db: Db, input: AddEntries, userId: number): PlanEntry[] {
  requireRow(db, input.rowId);
  let label = input.text;
  if (input.recipeId !== null) {
    const recipe = db
      .select({ title: recipes.title })
      .from(recipes)
      .where(and(eq(recipes.id, input.recipeId), isNull(recipes.deletedAt)))
      .get();
    if (!recipe) throw new HttpError(404, 'Recipe not found');
    label = recipe.title;
  }
  const dates = [...new Set(input.dates)];
  const ids = db.transaction((tx) =>
    dates.map(
      (date) =>
        tx
          .insert(planEntries)
          .values({ date, rowId: input.rowId, recipeId: input.recipeId, label, position: nextPosition(tx, date, input.rowId), createdBy: userId, createdAt: Date.now() })
          .returning({ id: planEntries.id })
          .get().id,
    ),
  );
  return entriesBetween(db, dates.reduce((a, b) => (a < b ? a : b)), dates.reduce((a, b) => (a > b ? a : b))).filter((e) => ids.includes(e.id));
}

export function planRoutes() {
  const app = new Hono<AppEnv>();
  app.use(requireMember);

  app.get('/', (c) => {
    const { from, to } = checkRange(c.req.query('from'), c.req.query('to'));
    return c.json(planView(c.var.db, from, to));
  });

  // ---- Entries ----

  app.post('/entries', async (c) => {
    const input = await parseBody(c, AddEntries);
    return c.json(addEntries(c.var.db, input, c.var.user!.id), 201);
  });

  app.patch('/entries/:id{[0-9]+}', async (c) => {
    const { date, rowId, copy } = await parseBody(c, MoveEntry);
    const db = c.var.db;
    const entry = db.select().from(planEntries).where(eq(planEntries.id, Number(c.req.param('id')))).get();
    if (!entry) throw new HttpError(404, 'That entry was already removed');
    requireRow(db, rowId);
    const position = nextPosition(db, date, rowId);
    if (copy) {
      db.insert(planEntries)
        .values({ date, rowId, recipeId: entry.recipeId, label: entry.label, position, createdBy: c.var.user!.id, createdAt: Date.now() })
        .run();
    } else {
      db.update(planEntries).set({ date, rowId, position }).where(eq(planEntries.id, entry.id)).run();
    }
    return c.json({ ok: true });
  });

  app.delete('/entries/:id{[0-9]+}', (c) => {
    // Removing something already gone is fine (two people tidying up at once).
    c.var.db.delete(planEntries).where(eq(planEntries.id, Number(c.req.param('id')))).run();
    return c.json({ ok: true });
  });

  app.post('/copy-week', async (c) => {
    const { from, to } = await parseBody(c, CopyWeek);
    const db = c.var.db;
    if (entriesBetween(db, to, addDays(to, 6)).length) {
      throw new HttpError(409, 'This week already has meals planned. Clear it first, or add to it by hand.');
    }
    const source = db.select().from(planEntries).where(and(gte(planEntries.date, from), lte(planEntries.date, addDays(from, 6)))).all();
    if (!source.length) throw new HttpError(400, 'That week has nothing to copy');
    const shift = (toTime(to) - toTime(from)) / 86_400_000;
    db.transaction((tx) => {
      for (const e of source) {
        tx.insert(planEntries)
          .values({ date: addDays(e.date, shift), rowId: e.rowId, recipeId: e.recipeId, label: e.label, position: e.position, createdBy: c.var.user!.id, createdAt: Date.now() })
          .run();
      }
    });
    return c.json({ copied: source.length });
  });

  /** The last few different things planned, for one-tap repeats. */
  app.get('/recent', (c) => {
    const rows = c.var.db
      .select({ label: planEntries.label, recipeId: planEntries.recipeId, title: recipes.title, deletedAt: recipes.deletedAt })
      .from(planEntries)
      .leftJoin(recipes, eq(recipes.id, planEntries.recipeId))
      .orderBy(desc(planEntries.createdAt), desc(planEntries.id))
      .limit(200)
      .all();
    const seen = new Set<string>();
    const out: RecentItem[] = [];
    for (const r of rows) {
      const live = r.recipeId !== null && r.deletedAt === null;
      const item: RecentItem = live ? { label: r.title!, recipeId: r.recipeId } : { label: r.label, recipeId: null };
      const key = item.recipeId ? `r${item.recipeId}` : `t${item.label.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length === 8) break;
    }
    return c.json(out);
  });

  app.get('/history/:recipeId{[0-9]+}', (c) => {
    const today = c.req.query('today') ?? new Date().toISOString().slice(0, 10);
    const from = addDays(today, -371);
    const to = addDays(today, 60);
    const days = c.var.db
      .select({ date: planEntries.date, row: planRows.name })
      .from(planEntries)
      .innerJoin(planRows, eq(planRows.id, planEntries.rowId))
      .where(and(eq(planEntries.recipeId, Number(c.req.param('recipeId'))), gte(planEntries.date, from), lte(planEntries.date, to)))
      .orderBy(asc(planEntries.date))
      .all();
    const body: RecipeHistory = { days };
    return c.json(body);
  });

  // ---- Rows ----

  app.post('/rows', async (c) => {
    const { name } = await parseBody(c, RowInput);
    const db = c.var.db;
    const position = (db.select({ m: max(planRows.position) }).from(planRows).get()?.m ?? -1) + 1;
    return c.json(db.insert(planRows).values({ name, position }).returning().get(), 201);
  });

  app.patch('/rows/:id{[0-9]+}', async (c) => {
    const { name } = await parseBody(c, RowInput);
    const changed = c.var.db.update(planRows).set({ name }).where(eq(planRows.id, Number(c.req.param('id')))).run().changes;
    if (!changed) throw new HttpError(404, 'That row no longer exists');
    return c.json({ ok: true });
  });

  app.put('/rows/order', async (c) => {
    const { ids } = await parseBody(c, RowOrder);
    const db = c.var.db;
    const existing = db.select({ id: planRows.id }).from(planRows).all().map((r) => r.id);
    if (ids.length !== existing.length || !existing.every((id) => ids.includes(id))) {
      throw new HttpError(409, 'The rows changed meanwhile. Reload and try again.');
    }
    db.transaction((tx) => ids.forEach((id, position) => tx.update(planRows).set({ position }).where(eq(planRows.id, id)).run()));
    return c.json({ ok: true });
  });

  app.delete('/rows/:id{[0-9]+}', (c) => {
    const db = c.var.db;
    if (db.select({ n: sql<number>`count(*)` }).from(planRows).get()!.n <= 1) throw new HttpError(400, 'Keep at least one row');
    const removed = db.delete(planRows).where(eq(planRows.id, Number(c.req.param('id')))).run().changes;
    if (!removed) throw new HttpError(404, 'That row no longer exists');
    return c.json({ ok: true });
  });

  // ---- Events ----

  app.post('/events', async (c) => {
    const e = await parseBody(c, EventInput);
    const row = c.var.db
      .insert(planEvents)
      .values({ name: e.name, fromDate: e.from, toDate: e.to, away: e.away, createdBy: c.var.user!.id, createdAt: Date.now() })
      .returning()
      .get();
    const body: PlanEvent = { id: row.id, name: row.name, from: row.fromDate, to: row.toDate, away: row.away };
    return c.json(body, 201);
  });

  app.patch('/events/:id{[0-9]+}', async (c) => {
    const e = await parseBody(c, EventInput);
    const changed = c.var.db
      .update(planEvents)
      .set({ name: e.name, fromDate: e.from, toDate: e.to, away: e.away })
      .where(eq(planEvents.id, Number(c.req.param('id'))))
      .run().changes;
    if (!changed) throw new HttpError(404, 'That event no longer exists');
    return c.json({ ok: true });
  });

  app.delete('/events/:id{[0-9]+}', (c) => {
    c.var.db.delete(planEvents).where(eq(planEvents.id, Number(c.req.param('id')))).run();
    return c.json({ ok: true });
  });

  return app;
}

