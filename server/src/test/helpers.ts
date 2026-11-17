import { loadConfig } from '../config.js';
import { openDb, type Db } from '../db/index.js';
import { createApp } from '../app.js';

export const ADMIN_PASSWORD = 'test-admin-password-1234';

/** A fresh app on an in-memory database. */
export function makeTestApp() {
  const config = loadConfig({
    NODE_ENV: 'test',
    WEB_DIR: '',
    MIGRATIONS_DIR: 'drizzle',
    ADMIN_PASSWORD,
    PUBLIC_URL: 'https://wecooked.test',
  });
  const db = openDb(':memory:', config.migrationsDir);
  const app = createApp({ config, db });
  return { app, db, config };
}

type App = ReturnType<typeof makeTestApp>['app'];

/** A browser-like client: keeps cookies between requests and sends JSON. */
export class Client {
  readonly cookies = new Map<string, string>();

  constructor(
    private readonly app: App,
    private readonly origin = 'https://wecooked.test',
  ) {}

  async request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { host: 'wecooked.test', 'user-agent': 'Mozilla/5.0 (iPhone) Safari/605.1', ...headers };
    if (method !== 'GET') h.origin ??= this.origin;
    if (body !== undefined) h['content-type'] = 'application/json';
    if (this.cookies.size) h.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await this.app.request(`https://wecooked.test${path}`, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      const eq = pair!.indexOf('=');
      const name = pair!.slice(0, eq);
      const value = pair!.slice(eq + 1);
      if (!value || /max-age=0/i.test(raw)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await res.text();
    let json: any = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { status: res.status, json, headers: res.headers };
  }

  get = (path: string) => this.request('GET', path);
  post = (path: string, body: unknown = {}) => this.request('POST', path, body);
  patch = (path: string, body: unknown) => this.request('PATCH', path, body);
  del = (path: string) => this.request('DELETE', path);
}

/** Unlocks /admin, creates an invite and joins with it. Returns the signed-in client. */
export async function createMember(app: App, username: string, password = 'password-123') {
  const admin = new Client(app);
  await admin.post('/api/admin/unlock', { password: ADMIN_PASSWORD });
  const invite = await admin.post('/api/admin/invites');
  const token = String(invite.json.url).split('/join/')[1];
  const member = new Client(app);
  const joined = await member.post('/api/auth/join', { token, username, password });
  if (joined.status !== 201) throw new Error(`join failed: ${JSON.stringify(joined.json)}`);
  return { member, admin, id: joined.json.user.id as number };
}

export function sessionCount(db: Db, userId: number): number {
  return (db.$client.prepare('select count(*) as n from sessions where user_id = ?').get(userId) as { n: number }).n;
}
