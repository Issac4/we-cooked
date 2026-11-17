import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { Hono, type MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import {
  AdminUnlock,
  type AdminInvite,
  type AdminLink,
  type AdminLogEntry,
  type AdminMember,
  type AdminState,
} from '@wecooked/shared';
import { randomToken, safeEqual, sha256 } from '../auth/crypto.js';
import { FailureLimiter } from '../auth/rate-limit.js';
import { signOutAllDevices } from '../auth/sessions.js';
import { adminLog, invites, resetTokens, sessions, users } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { clientIp, HttpError, parseBody } from '../http.js';

const ADMIN_COOKIE = 'wc_admin';
const ADMIN_TTL = 30 * 60 * 1000;
const INVITE_TTL = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL = 24 * 60 * 60 * 1000;

/**
 * /admin is unlocked with the shared ADMIN_PASSWORD. It is not an account:
 * unlocking gives a 30-minute, in-memory admin session that only manages people.
 */
export function adminRoutes() {
  const app = new Hono<AppEnv>();
  const adminSessions = new Map<string, number>(); // token hash -> expiresAt
  const byIp = new FailureLimiter(5, 15 * 60 * 1000);
  const overall = new FailureLimiter(20, 60 * 60 * 1000);

  function currentAdmin(token: string | undefined): number | null {
    if (!token) return null;
    const key = sha256(token);
    const expiresAt = adminSessions.get(key);
    if (!expiresAt) return null;
    if (expiresAt <= Date.now()) {
      adminSessions.delete(key);
      return null;
    }
    return expiresAt;
  }

  const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (!currentAdmin(getCookie(c, ADMIN_COOKIE))) throw new HttpError(401, 'The admin page is locked');
    await next();
  };

  function log(c: { var: AppEnv['Variables'] }, message: string) {
    c.var.db.insert(adminLog).values({ at: Date.now(), message }).run();
  }

  app.get('/state', (c) => {
    const expiresAt = currentAdmin(getCookie(c, ADMIN_COOKIE));
    const body: AdminState = { unlocked: expiresAt !== null, expiresAt };
    return c.json(body);
  });

  app.post('/unlock', async (c) => {
    const { password } = await parseBody(c, AdminUnlock);
    const ip = clientIp(c);
    if (byIp.isBlocked(ip) || overall.isBlocked('all')) {
      throw new HttpError(429, 'Too many wrong attempts. The admin page is locked for 15 minutes.');
    }
    if (!safeEqual(password, c.var.config.adminPassword)) {
      byIp.fail(ip);
      overall.fail('all');
      throw new HttpError(401, 'Wrong admin password', { password: 'Wrong admin password' });
    }
    byIp.reset(ip);
    const token = randomToken();
    const expiresAt = Date.now() + ADMIN_TTL;
    adminSessions.set(sha256(token), expiresAt);
    setCookie(c, ADMIN_COOKIE, token, {
      path: '/api/admin',
      httpOnly: true,
      sameSite: 'Strict',
      secure: c.var.config.publicUrl.startsWith('https://'),
      maxAge: ADMIN_TTL / 1000,
    });
    const body: AdminState = { unlocked: true, expiresAt };
    return c.json(body);
  });

  app.post('/lock', (c) => {
    const token = getCookie(c, ADMIN_COOKIE);
    if (token) adminSessions.delete(sha256(token));
    deleteCookie(c, ADMIN_COOKIE, { path: '/api/admin' });
    const body: AdminState = { unlocked: false, expiresAt: null };
    return c.json(body);
  });

  // ---- Everything below needs the admin page unlocked ----
  const gated = new Hono<AppEnv>();
  gated.use(requireAdmin);

  gated.get('/members', (c) => {
    const now = Date.now();
    const rows = c.var.db
      .select({
        id: users.id,
        username: users.username,
        createdAt: users.createdAt,
        devices: sql<number>`count(${sessions.id})`,
        lastActiveAt: sql<number | null>`max(${sessions.lastSeenAt})`,
      })
      .from(users)
      .leftJoin(sessions, and(eq(sessions.userId, users.id), gt(sessions.expiresAt, now)))
      .groupBy(users.id)
      .orderBy(users.createdAt)
      .all();
    const body: AdminMember[] = rows.map((r) => ({ ...r, devices: Number(r.devices) }));
    return c.json(body);
  });

  gated.post('/members/:id/reset-link', (c) => {
    const id = Number(c.req.param('id'));
    const db = c.var.db;
    const user = db.select({ username: users.username }).from(users).where(eq(users.id, id)).get();
    if (!user) throw new HttpError(404, 'Member not found');
    const token = randomToken();
    const now = Date.now();
    db.transaction((tx) => {
      // Only the newest reset link works.
      tx.update(resetTokens)
        .set({ usedAt: now })
        .where(and(eq(resetTokens.userId, id), isNull(resetTokens.usedAt)))
        .run();
      tx.insert(resetTokens)
        .values({ tokenHash: sha256(token), userId: id, createdAt: now, expiresAt: now + RESET_TTL })
        .run();
    });
    log(c, `Password reset link created for ${user.username}`);
    const body: AdminLink = { url: `${c.var.config.publicUrl}/reset/${token}`, expiresAt: now + RESET_TTL };
    return c.json(body, 201);
  });

  gated.post('/members/:id/sign-out', (c) => {
    const id = Number(c.req.param('id'));
    const user = c.var.db.select({ username: users.username }).from(users).where(eq(users.id, id)).get();
    if (!user) throw new HttpError(404, 'Member not found');
    const count = signOutAllDevices(c.var.db, id);
    log(c, `All devices signed out for ${user.username}`);
    return c.json({ ok: true, signedOut: count });
  });

  gated.delete('/members/:id', (c) => {
    const id = Number(c.req.param('id'));
    const db = c.var.db;
    const user = db.select({ username: users.username }).from(users).where(eq(users.id, id)).get();
    if (!user) throw new HttpError(404, 'Member not found');
    db.delete(users).where(eq(users.id, id)).run();
    log(c, `${user.username} was removed`);
    return c.json({ ok: true });
  });

  gated.get('/invites', (c) => {
    const rows = c.var.db
      .select()
      .from(invites)
      .where(and(isNull(invites.usedAt), gt(invites.expiresAt, Date.now())))
      .orderBy(desc(invites.createdAt))
      .all();
    const base = c.var.config.publicUrl;
    const body: AdminInvite[] = rows.map((r) => ({
      id: r.id,
      url: `${base}/join/${r.token}`,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    }));
    return c.json(body);
  });

  gated.post('/invites', (c) => {
    const token = randomToken();
    const now = Date.now();
    const row = c.var.db
      .insert(invites)
      .values({ token, createdAt: now, expiresAt: now + INVITE_TTL })
      .returning()
      .get();
    log(c, 'Invite link created');
    const body: AdminInvite = {
      id: row.id,
      url: `${c.var.config.publicUrl}/join/${token}`,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
    return c.json(body, 201);
  });

  gated.delete('/invites/:id', (c) => {
    const removed = c.var.db
      .delete(invites)
      .where(and(eq(invites.id, Number(c.req.param('id'))), isNull(invites.usedAt)))
      .run().changes;
    if (!removed) throw new HttpError(404, 'Invite not found');
    log(c, 'Invite link cancelled');
    return c.json({ ok: true });
  });

  gated.get('/log', (c) => {
    const rows = c.var.db.select().from(adminLog).orderBy(desc(adminLog.id)).limit(100).all();
    const body: AdminLogEntry[] = rows;
    return c.json(body);
  });

  app.route('/', gated);
  return app;
}
