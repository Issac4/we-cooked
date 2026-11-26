import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { IsoDate, RecipeInput, TagName, usernameKey as nameKey } from '@wecooked/shared';
import type { Db } from '../db/index.js';
import { planEntries, planRows, recipes, tagGroups, tags } from '../db/schema.js';
import type { CurrentApiKey, CurrentUser } from '../env.js';
import { HttpError } from '../http.js';
import { createRecipe, getRecipe, listRecipes, setCoverPhoto, updateRecipe } from '../recipes/service.js';
import { fetchImage } from '../photos/fetch-image.js';
import { createPhotoDrop } from '../photos/photo-drop.js';
import { saveImage } from '../routes/uploads.js';
import { addToCollection, listCollections, recipeIdsIn } from '../routes/collections.js';
import { addComment, listComments } from '../routes/comments.js';
import { addEntries, planView } from '../routes/plan.js';
import { getSettings } from '../routes/settings.js';
import { listTagGroups } from '../routes/tags.js';
import { guide, instructions } from './guide.js';
import { recipeWarnings } from './lint.js';
import { isSimilar } from './similar.js';

const ok = (data: unknown): CallToolResult => ({ content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] });
const fail = (message: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text: message }] });

/** Runs a tool body, turning our HTTP-style errors into tool errors the agent can read and act on. */
async function run(fn: () => CallToolResult | Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) {
      const fields = err.fields ? ` Details: ${JSON.stringify(err.fields)}` : '';
      return fail(`${err.message}.${fields}`);
    }
    console.error('MCP tool failed:', err);
    return fail('Something went wrong on the server.');
  }
}

/** The recipe body agents send: everything except the cover photo (uploads are done on the website). */
const AgentRecipe = RecipeInput.omit({ coverPhoto: true });

function validTagsMessage(db: Db): string {
  return listTagGroups(db)
    .map((g) => `${g.name}: ${g.tags.map((t) => `${t.name} (${t.id})`).join(', ')}`)
    .join('\n');
}

/** How often and when each recipe was cooked: meal-plan entries up to today. */
function cookedStats(db: Db, ids: number[]): Map<number, { times: number; last: string }> {
  const out = new Map<number, { times: number; last: string }>();
  if (!ids.length) return out;
  const today = new Date().toISOString().slice(0, 10);
  const rows = db
    .select({ recipeId: planEntries.recipeId, times: sql<number>`count(*)`, last: sql<string>`max(${planEntries.date})` })
    .from(planEntries)
    .where(and(inArray(planEntries.recipeId, ids), lte(planEntries.date, today)))
    .groupBy(planEntries.recipeId)
    .all();
  for (const r of rows) if (r.recipeId !== null) out.set(r.recipeId, { times: r.times, last: r.last });
  return out;
}

export interface McpContext {
  db: Db;
  user: CurrentUser;
  apiKey: CurrentApiKey;
  publicUrl: string;
  dataDir: string;
  /** The running release, e.g. "v2.4.1" (or "dev" / a commit sha outside releases). */
  version: string;
}

/** A fresh MCP server for one request, acting as the key's owner. */
export function buildMcpServer({ db, user, apiKey, publicUrl, dataDir, version }: McpContext): McpServer {
  const houseRules = getSettings(db).aiRules;
  const server = new McpServer({ name: 'we-cooked', version: version.replace(/^v/, '') }, { instructions: instructions(houseRules) });
  const actor = { userId: user.id, apiKeyName: apiKey.name };
  const canWrite = apiKey.scope === 'write';
  const readOnly = () => fail('This API key is read-only. Create a read-write key on your Me page to make changes.');
  const recipeUrl = (id: number) => `${publicUrl}/recipes/${id}`;

  server.registerTool(
    'get_guide',
    { title: 'Format rules and example', description: 'How recipes must be written here, the household’s own rules, and a complete example. Read this before creating recipes.', annotations: { readOnlyHint: true } },
    async () => ok(guide(houseRules)),
  );

  server.registerTool(
    'search_recipes',
    {
      title: 'Search recipes',
      description:
        'Find recipes by words in either name or in ingredients, optionally filtered by tag ids or a collection. Tags in the same group match any (Beef or Chicken); tags from different groups must all match (… and Dinner). Each result has the household rating (hearts, 1–5), how many times it was cooked (from the meal plan) and the last cooked date. Use sort for suggestions: "highest_rated" for favourites, "not_cooked_lately" for dishes that have not been made for a while (never-cooked first). Always search before creating.',
      inputSchema: {
        query: z.string().max(100).optional().describe('Words to look for'),
        tagIds: z.array(z.number().int()).max(20).optional(),
        collectionId: z.number().int().optional(),
        sort: z.enum(['title', 'newest', 'highest_rated', 'not_cooked_lately']).optional().describe('Default title'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, tagIds, collectionId, sort }) =>
      run(() => {
        let recipeIds: number[] | undefined;
        if (collectionId) {
          const ids = recipeIdsIn(db, collectionId);
          if (!ids) return fail('Collection not found. Use list_collections.');
          recipeIds = ids;
        }
        const { recipes: found } = listRecipes(db, { q: query, tagIds, recipeIds, sort: sort === 'newest' ? 'new' : sort === 'highest_rated' ? 'rating' : 'title' });
        const cooked = cookedStats(db, found.map((r) => r.id));
        const rows = found.map((r) => ({
          id: r.id,
          title: r.title,
          otherName: r.otherName,
          tags: r.tags.map((t) => t.name),
          rating: r.rating ? { hearts: r.rating.average, votes: r.rating.count } : null,
          timesCooked: cooked.get(r.id)?.times ?? 0,
          lastCooked: cooked.get(r.id)?.last ?? null,
          needsReview: r.needsReview,
        }));
        if (sort === 'not_cooked_lately') {
          // Never cooked first, then the longest ago.
          rows.sort((a, b) => (a.lastCooked ?? '').localeCompare(b.lastCooked ?? ''));
        }
        return ok({ count: rows.length, recipes: rows.slice(0, 50) });
      }),
  );

  server.registerTool(
    'get_recipe',
    { title: 'Get a recipe', description: 'The full recipe: ingredients, steps, tags, collections, the household rating (one vote per member) and the notes members have left (tips, changes for next time, who gave which hearts). Read the notes before editing or adding a note so you do not repeat or contradict them.', inputSchema: { id: z.number().int() }, annotations: { readOnlyHint: true } },
    async ({ id }) => run(() => {
      const r = getRecipe(db, id);
      if (!r) return fail('Recipe not found.');
      const notes = listComments(db, r.id, user.id).map((c) => ({ author: c.author, date: new Date(c.createdAt).toISOString().slice(0, 10), rating: c.rating, note: c.body }));
      return ok({ ...r, notes, url: recipeUrl(r.id) });
    }),
  );

  server.registerTool(
    'list_tags',
    { title: 'List tags', description: 'Every filter group and its tags with ids. Use these ids in create_recipe; do not invent new ones.', annotations: { readOnlyHint: true } },
    async () => ok(listTagGroups(db)),
  );

  server.registerTool(
    'create_tag',
    {
      title: 'Create a tag',
      description: 'Add a tag to an existing group. Only when clearly missing and the user agreed. Refuses names similar to existing tags unless confirmNew is true.',
      inputSchema: { groupId: z.number().int(), name: TagName, confirmNew: z.boolean().optional().describe('Set true only after checking the similar tags are really different') },
    },
    async ({ groupId, name, confirmNew }) =>
      run(() => {
        if (!canWrite) return readOnly();
        const group = db.select().from(tagGroups).where(eq(tagGroups.id, groupId)).get();
        if (!group) return fail(`No group with id ${groupId}. Groups:\n${validTagsMessage(db)}`);
        const all = db.select().from(tags).all();
        const exact = all.find((t) => t.groupId === groupId && t.nameKey === nameKey(name));
        if (exact) return ok({ message: 'Already exists; use this id.', tag: { id: exact.id, name: exact.name } });
        const similar = all.filter((t) => isSimilar(t.name, name));
        if (similar.length && !confirmNew) {
          return fail(`Similar tags already exist: ${similar.map((t) => `${t.name} (${t.id})`).join(', ')}. Use one of them, or call again with confirmNew: true if yours is really different.`);
        }
        const position = all.filter((t) => t.groupId === groupId).length;
        const t = db.insert(tags).values({ groupId, name, nameKey: nameKey(name), position }).returning().get();
        return ok({ id: t.id, groupId, name: t.name });
      }),
  );

  server.registerTool(
    'create_recipe',
    {
      title: 'Create a recipe',
      description: 'Add a new recipe. Show the user the draft and get their OK first, unless they clearly said to import directly without review. Search first. Steps need section "preparation" or "cooking"; ingredients need numeric quantities. Ingredient notes only describe the item ("diced", "about 1.4 kg"); anything to DO (wash, soak, cut, reserve) goes in a preparation step. The result may include warnings to fix. Refuses names or source links similar to existing recipes unless confirmNew is true. The recipe is marked "needs review".',
      inputSchema: { recipe: AgentRecipe, confirmNew: z.boolean().optional().describe('Set true only after checking the similar recipes are really different dishes') },
    },
    async ({ recipe, confirmNew }) =>
      run(() => {
        if (!canWrite) return readOnly();
        const existing = db
          .select({ id: recipes.id, title: recipes.title, otherName: recipes.otherName, links: recipes.links })
          .from(recipes)
          .where(isNull(recipes.deletedAt))
          .all();
        const newUrls = new Set(recipe.links.map((l) => l.url));
        const similar = existing.filter(
          (r) =>
            [r.title, r.otherName].some((n) => n && [recipe.title, recipe.otherName].some((m) => m && isSimilar(n, m))) ||
            r.links.some((l) => newUrls.has(l.url)),
        );
        if (similar.length && !confirmNew) {
          return fail(
            `Possible duplicates: ${similar.map((r) => `"${r.title}" (id ${r.id})`).join(', ')}. Use get_recipe and update_recipe if it is the same dish, or call again with confirmNew: true if it is really different.`,
          );
        }
        const known = new Set(db.select({ id: tags.id }).from(tags).all().map((t) => t.id));
        const unknown = recipe.tagIds.filter((id) => !known.has(id));
        if (unknown.length) return fail(`Unknown tag id(s): ${unknown.join(', ')}. Valid tags:\n${validTagsMessage(db)}`);
        const created = createRecipe(db, { ...recipe, coverPhoto: null }, actor);
        const warnings = recipeWarnings(recipe);
        return ok({
          id: created.id,
          url: recipeUrl(created.id),
          message: 'Created. It shows "Added by AI · needs review" until a member checks it.',
          ...(warnings.length ? { warnings, action: 'Fix these with update_recipe now, before telling the user it is done.' } : {}),
        });
      }),
  );

  server.registerTool(
    'update_recipe',
    {
      title: 'Update a recipe',
      description: 'Replace a recipe’s content. Call get_recipe first and send the whole recipe back with your changes: turn its tags into tagIds (just the ids), and leave out the read-only fields (id, url, coverPhoto, notes, rating, collections, createdAt/updatedAt, createdBy/updatedBy, needsReview, aiKeyName). The cover photo is kept; if it is null, add one with set_recipe_photo_from_url. Marks it "needs review". Same rule as create_recipe: instructions belong in steps, not ingredient notes.',
      inputSchema: { id: z.number().int(), recipe: AgentRecipe },
    },
    async ({ id, recipe }) =>
      run(() => {
        if (!canWrite) return readOnly();
        const current = db.select({ coverPhoto: recipes.coverPhoto }).from(recipes).where(and(eq(recipes.id, id), isNull(recipes.deletedAt))).get();
        if (!current) return fail('Recipe not found.');
        const known = new Set(db.select({ id: tags.id }).from(tags).all().map((t) => t.id));
        const unknown = recipe.tagIds.filter((t) => !known.has(t));
        if (unknown.length) return fail(`Unknown tag id(s): ${unknown.join(', ')}. Valid tags:\n${validTagsMessage(db)}`);
        updateRecipe(db, id, { ...recipe, coverPhoto: current.coverPhoto }, actor);
        const warnings = recipeWarnings(recipe);
        return ok({
          id,
          url: recipeUrl(id),
          message: 'Updated and marked for review.',
          ...(warnings.length ? { warnings, action: 'Fix these with update_recipe now, before telling the user it is done.' } : {}),
        });
      }),
  );

  server.registerTool(
    'set_recipe_photo_from_url',
    {
      title: 'Set a recipe photo from a link',
      description:
        'Download a photo from a public http(s) link (e.g. the image on a recipe page, or https://i.ytimg.com/vi/<videoId>/maxresdefault.jpg for a YouTube video, or hqdefault.jpg if that fails) and make it the recipe’s cover. For a file on the user’s computer use get_photo_upload_link instead.',
      inputSchema: { recipeId: z.number().int(), url: z.string().url().max(2000) },
    },
    async ({ recipeId, url }) =>
      run(async () => {
        if (!canWrite) return readOnly();
        if (!getRecipe(db, recipeId)) return fail('Recipe not found.');
        const upload = await saveImage(db, dataDir, await fetchImage(url), user.id);
        setCoverPhoto(db, recipeId, upload.id, actor);
        return ok({ recipeId, url: recipeUrl(recipeId), message: `Photo set (${upload.width}×${upload.height}).` });
      }),
  );

  server.registerTool(
    'get_photo_upload_link',
    {
      title: 'Get a one-time photo upload link',
      description:
        'For a photo file on the user’s computer: returns a curl command that uploads the file straight to this recipe (no API key needed). Replace the path, then run it in a shell. The link works once and expires in 10 minutes. Max 15 MB; JPEG, PNG, WebP or HEIC.',
      inputSchema: { recipeId: z.number().int() },
    },
    async ({ recipeId }) =>
      run(() => {
        if (!canWrite) return readOnly();
        if (!getRecipe(db, recipeId)) return fail('Recipe not found.');
        const { token, expiresAt } = createPhotoDrop(recipeId, actor);
        const link = `${publicUrl}/api/photo-drop/${token}`;
        return ok({
          command: `curl -fsS -F "file=@/path/to/photo.jpg" ${link}`,
          expiresAt: new Date(expiresAt).toISOString(),
          note: 'Replace /path/to/photo.jpg with the real file (quote paths with spaces). A successful upload prints {"ok":true,...}.',
        });
      }),
  );

  server.registerTool(
    'list_collections',
    { title: 'List collections', description: 'Collections (themed sets like "Weeknight") with ids and recipe counts.', annotations: { readOnlyHint: true } },
    async () => ok(listCollections(db)),
  );

  server.registerTool(
    'add_to_collection',
    { title: 'Add recipes to a collection', description: 'Put recipes in an existing collection.', inputSchema: { collectionId: z.number().int(), recipeIds: z.array(z.number().int()).min(1).max(100) } },
    async ({ collectionId, recipeIds }) =>
      run(() => {
        if (!canWrite) return readOnly();
        return ok({ added: addToCollection(db, collectionId, recipeIds) });
      }),
  );

  server.registerTool(
    'add_comment',
    {
      title: 'Add a note to a recipe',
      description:
        'A "note from the kitchen" in the recipe’s Notes: tips, brand advice, how it turned out, what to change next time, and optionally a 1–5 rating shown as hearts. Posted as the key’s owner, so only include a rating the person actually gave; never guess one. Each member’s latest rating counts once in the recipe’s score. If the change is to the method itself, use update_recipe instead. Read the existing notes with get_recipe first.',
      inputSchema: {
        recipeId: z.number().int(),
        body: z.string().trim().max(2000).optional().describe('The note; may be empty when only rating'),
        rating: z.number().int().min(1).max(5).optional().describe('Hearts the person gave, 1–5'),
      },
    },
    async ({ recipeId, body, rating }) =>
      run(() => {
        if (!canWrite) return readOnly();
        if (!body && !rating) return fail('Give a note, a rating, or both.');
        return ok(addComment(db, recipeId, user.id, { body: body ?? '', rating: rating ?? null }));
      }),
  );

  server.registerTool(
    'get_meal_plan',
    { title: 'Read the meal plan', description: 'Planned meals, rows, events (trips: "away" means no meals at home) and public holidays between two dates (at most 62 days).', inputSchema: { from: IsoDate, to: IsoDate }, annotations: { readOnlyHint: true } },
    async ({ from, to }) =>
      run(() => {
        if (to < from) return fail('"to" is before "from".');
        const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
        if (days > 62) return fail('Ask for at most 62 days at a time.');
        return ok(planView(db, from, to));
      }),
  );

  server.registerTool(
    'add_plan_entry',
    {
      title: 'Add to the meal plan',
      description: 'Put a recipe (by id) or plain text on one or more days in a row such as "Dinner". Check get_meal_plan for away days first.',
      inputSchema: {
        dates: z.array(IsoDate).min(1).max(31),
        row: z.string().describe('Row name, e.g. "Breakfast", "Lunch", "Dinner"'),
        recipeId: z.number().int().optional(),
        text: z.string().trim().max(120).optional().describe('Plain text when there is no recipe, e.g. "Leftovers"'),
      },
    },
    async ({ dates, row, recipeId, text }) =>
      run(() => {
        if (!canWrite) return readOnly();
        const rows = db.select().from(planRows).all();
        const match = rows.find((r) => r.name.toLowerCase() === row.trim().toLowerCase());
        if (!match) return fail(`No row called "${row}". Rows: ${rows.map((r) => r.name).join(', ')}.`);
        if (!recipeId && !text) return fail('Give a recipeId or some text.');
        const added = addEntries(db, { dates, rowId: match.id, recipeId: recipeId ?? null, text: text ?? '' }, user.id);
        return ok({ added: added.length });
      }),
  );

  return server;
}
