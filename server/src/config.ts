import path from 'node:path';

export interface Config {
  production: boolean;
  port: number;
  /** Folder holding the SQLite file and uploaded photos. */
  dataDir: string;
  /** Folder with the built web app (index.html + assets). Empty = API only. */
  webDir: string;
  migrationsDir: string;
  /** Shared password that unlocks /admin. */
  adminPassword: string;
  /** Public address, used in invite links and share previews. */
  publicUrl: string;
  version: string;
}

const MIN_ADMIN_PASSWORD = 16;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const cwd = process.cwd();
  const adminPassword = env.ADMIN_PASSWORD ?? '';

  if (production && adminPassword.length < MIN_ADMIN_PASSWORD) {
    throw new Error(
      `ADMIN_PASSWORD must be set and at least ${MIN_ADMIN_PASSWORD} characters long. ` +
        'Generate one with: openssl rand -base64 24',
    );
  }

  return {
    production,
    port: Number(env.PORT ?? 8000),
    dataDir: path.resolve(env.DATA_DIR ?? path.join(cwd, 'data')),
    webDir: env.WEB_DIR !== undefined ? env.WEB_DIR : path.resolve(cwd, '../web/dist'),
    migrationsDir: path.resolve(env.MIGRATIONS_DIR ?? path.join(cwd, 'drizzle')),
    adminPassword: adminPassword || 'dev-admin-password',
    publicUrl: (env.PUBLIC_URL ?? `http://localhost:${env.PORT ?? 8000}`).replace(/\/$/, ''),
    version: env.APP_VERSION ?? 'dev',
  };
}
