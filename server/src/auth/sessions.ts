import { and, eq, lt, ne } from 'drizzle-orm';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Db } from '../db/index.js';
import { sessions, users } from '../db/schema.js';
import type { AppEnv, CurrentSession, CurrentUser } from '../env.js';
import { randomToken, sha256 } from './crypto.js';
import { describeDevice } from './device.js';

export const SESSION_COOKIE = 'wc_session';
const DAY = 24 * 60 * 60 * 1000;
export const SESSION_TTL = 365 * DAY;
/** How often a visit pushes the expiry forward again. */
const RENEW_AFTER = DAY;

function cookieOptions(c: Context<AppEnv>) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
    secure: c.var.config.publicUrl.startsWith('https://'),
    maxAge: SESSION_TTL / 1000,
  };
}

/** Signs this device in as `userId` and sets the cookie. */
export function startSession(c: Context<AppEnv>, userId: number): CurrentSession {
  const db = c.var.db;
  const token = randomToken();
  const now = Date.now();
  const id = randomToken(12);
  db.insert(sessions)
    .values({
      id,
      tokenHash: sha256(token),
      userId,
      device: describeDevice(c.req.header('user-agent')),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + SESSION_TTL,
    })
    .run();
  setCookie(c, SESSION_COOKIE, token, cookieOptions(c));
  return { id, userId };
}

export function endSession(c: Context<AppEnv>): void {
  const session = c.var.session;
  if (session) c.var.db.delete(sessions).where(eq(sessions.id, session.id)).run();
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

/**
 * Reads the session cookie. Valid sessions are renewed at most once a day so a
 * device that is used at least once a year never has to sign in again.
 */
export function readSession(c: Context<AppEnv>): { user: CurrentUser; session: CurrentSession } | null {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;

  const db = c.var.db;
  const row = db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      userId: users.id,
      username: users.username,
      passwordResetAt: users.passwordResetAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, sha256(token)))
    .get();

  const now = Date.now();
  if (!row || row.expiresAt <= now) {
    if (row) db.delete(sessions).where(eq(sessions.id, row.sessionId)).run();
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return null;
  }

  if (now - row.lastSeenAt > RENEW_AFTER) {
    db.update(sessions)
      .set({ lastSeenAt: now, expiresAt: now + SESSION_TTL })
      .where(eq(sessions.id, row.sessionId))
      .run();
    setCookie(c, SESSION_COOKIE, token, cookieOptions(c));
  }

  return {
    user: { id: row.userId, username: row.username, passwordResetAt: row.passwordResetAt },
    session: { id: row.sessionId, userId: row.userId },
  };
}

/** Signs a member out everywhere, optionally keeping one session (this device). */
export function signOutAllDevices(db: Db, userId: number, exceptSessionId?: string): number {
  const where = exceptSessionId
    ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId))
    : eq(sessions.userId, userId);
  return db.delete(sessions).where(where).run().changes;
}

export function purgeExpiredSessions(db: Db): void {
  db.delete(sessions).where(lt(sessions.expiresAt, Date.now())).run();
}
