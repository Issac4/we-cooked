import path from 'node:path';
import { serve } from '@hono/node-server';
import { loadConfig } from './config.js';
import { openDb } from './db/index.js';
import { createApp } from './app.js';

let config: ReturnType<typeof loadConfig>;
try {
  config = loadConfig();
} catch (err) {
  console.error(`Cannot start: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const db = openDb(path.join(config.dataDir, 'wecooked.db'), config.migrationsDir);
const app = createApp({ config, db });

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`We Cooked ${config.version} listening on http://localhost:${info.port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    db.$client.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
