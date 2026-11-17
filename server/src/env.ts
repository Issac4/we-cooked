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

/** Hono context variables available to every route. */
export interface AppEnv {
  Variables: {
    config: Config;
    db: Db;
    user: CurrentUser | null;
    session: CurrentSession | null;
  };
}
