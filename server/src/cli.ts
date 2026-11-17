/**
 * Small maintenance commands, run inside the container:
 *   docker compose exec app node dist/cli.js backup
 *   docker compose exec app node dist/cli.js backup /data/backups/before-update.db
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const [command, arg] = process.argv.slice(2);
const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
const dbFile = path.join(dataDir, 'wecooked.db');

async function backup(target?: string) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const out = path.resolve(target ?? path.join(dataDir, 'backups', `wecooked-${stamp}.db`));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const db = new Database(dbFile, { readonly: true, fileMustExist: true });
  // SQLite's online backup: safe while the app is running.
  await db.backup(out);
  db.close();
  console.log(`Database copied to ${out}`);
  console.log(`Photos are in ${path.join(dataDir, 'uploads')}; copy that folder too.`);
}

if (command === 'backup') {
  backup(arg).catch((err) => {
    console.error(`Backup failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
} else {
  console.log('Usage: node dist/cli.js backup [file]');
  process.exit(command ? 1 : 0);
}
