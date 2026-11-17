import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { IngredientSection, SourceLink, Step } from '@wecooked/shared';

/**
 * Household-wide settings as key/value JSON (week start, holiday calendars,
 * AI house rules, ...).
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
});

/** Household members. All members are equal; there are no roles. */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  /** Lower-cased, NFKC-normalised username for case-insensitive uniqueness and login. */
  usernameKey: text('username_key').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull(),
  /** Set when /admin reset the password; cleared when the member dismisses the notice. */
  passwordResetAt: integer('password_reset_at'),
});

/** One row per signed-in device. The cookie holds a random token; only its hash is stored. */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    tokenHash: text('token_hash').notNull().unique(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    device: text('device').notNull(),
    createdAt: integer('created_at').notNull(),
    lastSeenAt: integer('last_seen_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** Single-use invite links created from /admin. */
export const invites = sqliteTable('invites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Kept in plain text so /admin can copy the link again; links expire after 7 days. */
  token: text('token').notNull().unique(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
  usedBy: integer('used_by').references(() => users.id, { onDelete: 'set null' }),
});

/** Single-use password reset links created from /admin. Only the hash is stored. */
export const resetTokens = sqliteTable('reset_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenHash: text('token_hash').notNull().unique(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
});

// ---------- Recipes ----------

/** A filter group in the sidebar, e.g. "Protein". */
export const tagGroups = sqliteTable('tag_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull().unique(),
  position: integer('position').notNull(),
});

/** A filter pill, e.g. "Chicken" in "Protein". */
export const tags = sqliteTable(
  'tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    groupId: integer('group_id')
      .notNull()
      .references(() => tagGroups.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [uniqueIndex('tags_group_name_idx').on(t.groupId, t.nameKey)],
);

export const recipes = sqliteTable(
  'recipes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    otherName: text('other_name').notNull().default(''),
    description: text('description').notNull().default(''),
    coverPhoto: text('cover_photo').references(() => uploads.id, { onDelete: 'set null' }),
    servings: integer('servings'),
    prepMins: integer('prep_mins'),
    cookMins: integer('cook_mins'),
    ingredients: text('ingredients', { mode: 'json' }).$type<IngredientSection[]>().notNull(),
    steps: text('steps', { mode: 'json' }).$type<Step[]>().notNull(),
    links: text('links', { mode: 'json' }).$type<SourceLink[]>().notNull(),
    /** Set when an AI agent created or edited it, until a member marks it reviewed. */
    needsReview: integer('needs_review', { mode: 'boolean' }).notNull().default(false),
    /** Name of the API key used for the last AI change, shown with the review badge. */
    aiKeyName: text('ai_key_name'),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull(),
    updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: integer('updated_at').notNull(),
    /** In Trash since; purged 30 days later. */
    deletedAt: integer('deleted_at'),
    deletedBy: integer('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [index('recipes_deleted_idx').on(t.deletedAt), index('recipes_created_idx').on(t.createdAt)],
);

export const recipeTags = sqliteTable(
  'recipe_tags',
  {
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.tagId] }), index('recipe_tags_tag_idx').on(t.tagId, t.recipeId)],
);

/** Uploaded photos (stored as WebP files in DATA_DIR/uploads). */
export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  bytes: integer('bytes').notNull(),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull(),
});

// ---------- Collections ----------

/** A named set of recipes ("Weeknight 30-min", "CNY 2027"). */
export const collections = sqliteTable('collections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull().unique(),
  description: text('description').notNull().default(''),
  color: text('color').notNull(),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull(),
});

export const recipeCollections = sqliteTable(
  'recipe_collections',
  {
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    collectionId: integer('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    addedAt: integer('added_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.collectionId] }), index('recipe_collections_collection_idx').on(t.collectionId, t.recipeId)],
);

// ---------- Comments ----------

/** "Notes from the kitchen" on a recipe. Only the author can edit or delete one. */
export const comments = sqliteTable(
  'comments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    recipeId: integer('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    /** 1–5 stars, or null for a plain note. */
    rating: integer('rating'),
    createdAt: integer('created_at').notNull(),
    editedAt: integer('edited_at'),
  },
  (t) => [index('comments_recipe_idx').on(t.recipeId, t.createdAt)],
);

// ---------- Meal plan ----------

/** Rows of the week grid: Breakfast, Lunch, Dinner, plus any the household adds. */
export const planRows = sqliteTable('plan_rows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  position: integer('position').notNull(),
});

/** One thing planned in a cell: a linked recipe or plain text. */
export const planEntries = sqliteTable(
  'plan_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    date: text('date').notNull(),
    rowId: integer('row_id')
      .notNull()
      .references(() => planRows.id, { onDelete: 'cascade' }),
    recipeId: integer('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
    /** Recipe title when added (kept if the recipe is later deleted), or the typed text. */
    label: text('label').notNull(),
    position: integer('position').notNull(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('plan_entries_date_idx').on(t.date), index('plan_entries_recipe_idx').on(t.recipeId, t.date)],
);

/** Trips, visits and parties shown above the grid. */
export const planEvents = sqliteTable(
  'plan_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    fromDate: text('from_date').notNull(),
    toDate: text('to_date').notNull(),
    away: integer('away', { mode: 'boolean' }).notNull(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('plan_events_range_idx').on(t.fromDate, t.toDate)],
);

// ---------- API keys (for AI agents via MCP and the REST API) ----------

export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** First characters of the key, so people can tell keys apart. */
  prefix: text('prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  /** 'read' or 'write'. */
  scope: text('scope').notNull(),
  createdAt: integer('created_at').notNull(),
  lastUsedAt: integer('last_used_at'),
});

/** What happened on /admin and with invites, newest first in the UI. */
export const adminLog = sqliteTable('admin_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  at: integer('at').notNull(),
  message: text('message').notNull(),
});
