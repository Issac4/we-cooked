import { and, desc, eq, gt, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { ChangePassword, UpdateMe, usernameKey, type DeviceSession, type MeResponse } from '@wecooked/shared';
import { hashPassword, verifyPassword } from '../auth/crypto.js';
import { signOutAllDevices } from '../auth/sessions.js';
import { sessions, users } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { HttpError, parseBody, requireMember } from '../http.js';
import { toMe } from './auth.js';

/** The signed-in member managing their own account. */
export function meRoutes() {
  const app = new Hono<AppEnv>();
  app.use(requireMember);

  app.patch('/', async (c) => {
    const { username } = await parseBody(c, UpdateMe);
    const me = c.var.user!;
    const key = usernameKey(username);
    const db = c.var.db;
    const clash = db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.usernameKey, key), ne(users.id, me.id)))
      .get();
    if (clash) throw new HttpError(409, 'That username is taken', { username: 'That username is taken' });
    db.update(users).set({ username: username.trim(), usernameKey: key }).where(eq(users.id, me.id)).run();
    const body: MeResponse = { user: toMe({ ...me, username: username.trim() }) };
    return c.json(body);
  });

  app.post('/password', async (c) => {
    const { currentPassword, newPassword } = await parseBody(c, ChangePassword);
    const me = c.var.user!;
    const db = c.var.db;
    const row = db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, me.id)).get();
    if (!(await verifyPassword(row?.passwordHash, currentPassword))) {
      throw new HttpError(400, 'Current password is wrong', { currentPassword: 'Current password is wrong' });
    }
    db.update(users)
      .set({ passwordHash: await hashPassword(newPassword) })
      .where(eq(users.id, me.id))
      .run();
    // Other devices sign out; this one stays signed in.
    const signedOut = signOutAllDevices(db, me.id, c.var.session!.id);
    return c.json({ ok: true, signedOut });
  });

  app.post('/notice/dismiss', (c) => {
    c.var.db.update(users).set({ passwordResetAt: null }).where(eq(users.id, c.var.user!.id)).run();
    return c.json({ ok: true });
  });

  app.get('/sessions', (c) => {
    const current = c.var.session!.id;
    const rows = c.var.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, c.var.user!.id), gt(sessions.expiresAt, Date.now())))
      .orderBy(desc(sessions.lastSeenAt))
      .all();
    const body: DeviceSession[] = rows.map((s) => ({
      id: s.id,
      device: s.device,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      current: s.id === current,
    }));
    return c.json(body);
  });

  app.delete('/sessions/:id', (c) => {
    const removed = c.var.db
      .delete(sessions)
      .where(and(eq(sessions.id, c.req.param('id')), eq(sessions.userId, c.var.user!.id)))
      .run().changes;
    if (!removed) throw new HttpError(404, 'That device is already signed out');
    return c.json({ ok: true });
  });

  return app;
}
