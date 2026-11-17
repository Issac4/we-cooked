import { eq } from 'drizzle-orm';
import type { ApiKeyScope } from '@wecooked/shared';
import type { Db } from '../db/index.js';
import { apiKeys, users } from '../db/schema.js';
import type { CurrentApiKey, CurrentUser } from '../env.js';
import { randomToken, sha256 } from './crypto.js';

export const KEY_PREFIX = 'wc_';

/** Creates a key for a member. The full key is only ever returned here. */
export function createApiKey(db: Db, userId: number, name: string, scope: ApiKeyScope) {
  const key = `${KEY_PREFIX}${randomToken(24)}`;
  const row = db
    .insert(apiKeys)
    .values({ userId, name, scope, prefix: key.slice(0, 10), keyHash: sha256(key), createdAt: Date.now() })
    .returning()
    .get();
  return { key, row };
}

/** Resolves "Authorization: Bearer wc_…" to the member it belongs to. */
export function readApiKey(db: Db, header: string | undefined): { user: CurrentUser; apiKey: CurrentApiKey } | null {
  const match = header?.match(/^Bearer\s+(wc_[A-Za-z0-9_-]+)$/);
  if (!match) return null;
  const row = db
    .select({
      keyId: apiKeys.id,
      name: apiKeys.name,
      scope: apiKeys.scope,
      lastUsedAt: apiKeys.lastUsedAt,
      userId: users.id,
      username: users.username,
      passwordResetAt: users.passwordResetAt,
    })
    .from(apiKeys)
    .innerJoin(users, eq(users.id, apiKeys.userId))
    .where(eq(apiKeys.keyHash, sha256(match[1]!)))
    .get();
  if (!row) return null;
  // "Last used" only needs minute precision; avoid a write on every call.
  const now = Date.now();
  if (!row.lastUsedAt || now - row.lastUsedAt > 60_000) {
    db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, row.keyId)).run();
  }
  return {
    user: { id: row.userId, username: row.username, passwordResetAt: row.passwordResetAt },
    apiKey: { id: row.keyId, name: row.name, scope: row.scope as ApiKeyScope },
  };
}
