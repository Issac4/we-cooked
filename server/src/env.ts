import type { ApiKeyScope } from '@wecooked/shared';
import type { Config } from './config.js';
import type { Db } from './db/index.js';

export interface CurrentUser {
  id: number;
  username: string;
  passwordResetAt: number | null;
}

export interface CurrentSession {
  id: string;
  userId: number;
}

/** Set when the request authenticated with an API key instead of a browser session. */
export interface CurrentApiKey {
  id: number;
  name: string;
  scope: ApiKeyScope;
}

/** Hono context variables available to every route. */
export interface AppEnv {
  Variables: {
    config: Config;
    db: Db;
    user: CurrentUser | null;
    session: CurrentSession | null;
    apiKey: CurrentApiKey | null;
  };
}
