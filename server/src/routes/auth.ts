import { and, eq, gt, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  JoinRequest,
  LoginRequest,
  ResetRequest,
  usernameKey,
  type MeResponse,
  type TokenStatus,
} from '@wecooked/shared';
import { hashPassword, sha256, verifyPassword } from '../auth/crypto.js';
import { FailureLimiter } from '../auth/rate-limit.js';
import { endSession, signOutAllDevices, startSession } from '../auth/sessions.js';
import { adminLog, invites, resetTokens, users } from '../db/schema.js';
import type { AppEnv, CurrentUser } from '../env.js';
import { clientIp, HttpError, parseBody } from '../http.js';

const MINUTES_15 = 15 * 60 * 1000;

export function toMe(user: CurrentUser): NonNullable<MeResponse['user']> {
  return { id: user.id, username: user.username, passwordResetAt: user.passwordResetAt };
}

export function authRoutes() {
  const app = new Hono<AppEnv>();
  // Wrong passwords: 10 per username and 30 per IP every 15 minutes.
  const byUser = new FailureLimiter(10, MINUTES_15);
  const byIp = new FailureLimiter(30, MINUTES_15);

  app.get('/me', (c) => {
    const user = c.var.user;
    const body: MeResponse = { user: user ? toMe(user) : null };
    return c.json(body);
  });

  app.post('/login', async (c) => {
    const { username, password } = await parseBody(c, LoginRequest);
    const key = usernameKey(username);
    const ip = clientIp(c);
    if (byUser.isBlocked(key) || byIp.isBlocked(ip)) {
      throw new HttpError(429, 'Too many wrong passwords. Wait 15 minutes and try again.');
    }

    const user = c.var.db.select().from(users).where(eq(users.usernameKey, key)).get();
    const ok = await verifyPassword(user?.passwordHash, password);
    if (!user || !ok) {
      byUser.fail(key);
      byIp.fail(ip);
      throw new HttpError(401, 'Wrong username or password');
    }
    byUser.reset(key);

    startSession(c, user.id);
    const body: MeResponse = {
      user: toMe({ id: user.id, username: user.username, passwordResetAt: user.passwordResetAt }),
    };
    return c.json(body);
  });

  app.post('/logout', (c) => {
    endSession(c);
    return c.json({ ok: true });
  });

  // ---- Invite links ----

  app.get('/join/:token', (c) => {
    const invite = findOpenInvite(c.var.db, c.req.param('token'));
    if (!invite) throw new HttpError(410, 'This invite link has expired or was already used. Ask for a new one.');
    const body: TokenStatus = { valid: true };
    return c.json(body);
  });

  app.post('/join', async (c) => {
    const { token, username, password } = await parseBody(c, JoinRequest);
    const db = c.var.db;
    const passwordHash = await hashPassword(password);

    const user = db.transaction((tx) => {
      const invite = findOpenInvite(tx, token);
      if (!invite) throw new HttpError(410, 'This invite link has expired or was already used. Ask for a new one.');
      const key = usernameKey(username);
      if (tx.select({ id: users.id }).from(users).where(eq(users.usernameKey, key)).get()) {
        throw new HttpError(409, 'That username is taken', { username: 'That username is taken' });
      }
      const now = Date.now();
      const created = tx
        .insert(users)
        .values({ username: username.trim(), usernameKey: key, passwordHash, createdAt: now })
        .returning()
        .get();
      tx.update(invites).set({ usedAt: now, usedBy: created.id }).where(eq(invites.id, invite.id)).run();
      tx.insert(adminLog).values({ at: now, message: `${created.username} joined with an invite link` }).run();
      return created;
    });

    startSession(c, user.id);
    const body: MeResponse = { user: toMe({ id: user.id, username: user.username, passwordResetAt: null }) };
    return c.json(body, 201);
  });

  // ---- Password reset links ----

  app.get('/reset/:token', (c) => {
    const found = findOpenReset(c.var.db, c.req.param('token'));
    if (!found) throw new HttpError(410, 'This reset link has expired or was already used. Ask for a new one.');
    const body: TokenStatus = { valid: true, username: found.username };
    return c.json(body);
  });

  app.post('/reset', async (c) => {
    const { token, password } = await parseBody(c, ResetRequest);
    const db = c.var.db;
    const passwordHash = await hashPassword(password);

    const user = db.transaction((tx) => {
      const found = findOpenReset(tx, token);
      if (!found) throw new HttpError(410, 'This reset link has expired or was already used. Ask for a new one.');
      const now = Date.now();
      tx.update(users).set({ passwordHash, passwordResetAt: now }).where(eq(users.id, found.userId)).run();
      tx.update(resetTokens).set({ usedAt: now }).where(eq(resetTokens.id, found.id)).run();
      tx.insert(adminLog).values({ at: now, message: `${found.username} set a new password with a reset link` }).run();
      return { id: found.userId, username: found.username, passwordResetAt: now };
    });

    // Whoever had the old password is signed out everywhere; this device signs in fresh.
    signOutAllDevices(db, user.id);
    startSession(c, user.id);
    const body: MeResponse = { user: toMe(user) };
    return c.json(body);
  });

  return app;
}

type Tx = Parameters<Parameters<AppEnv['Variables']['db']['transaction']>[0]>[0];
type DbLike = AppEnv['Variables']['db'] | Tx;

function findOpenInvite(db: DbLike, token: string) {
  return db
    .select({ id: invites.id })
    .from(invites)
    .where(and(eq(invites.token, token), isNull(invites.usedAt), gt(invites.expiresAt, Date.now())))
    .get();
}

function findOpenReset(db: DbLike, token: string) {
  return db
    .select({ id: resetTokens.id, userId: resetTokens.userId, username: users.username })
    .from(resetTokens)
    .innerJoin(users, eq(users.id, resetTokens.userId))
    .where(
      and(eq(resetTokens.tokenHash, sha256(token)), isNull(resetTokens.usedAt), gt(resetTokens.expiresAt, Date.now())),
    )
    .get();
}
