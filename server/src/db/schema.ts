import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Household-wide settings as key/value JSON (week start, holiday calendars,
 * AI house rules, ...). Later milestones add the other tables.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
});
