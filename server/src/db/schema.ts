import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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

/** What happened on /admin and with invites, newest first in the UI. */
export const adminLog = sqliteTable('admin_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  at: integer('at').notNull(),
  message: text('message').notNull(),
});
