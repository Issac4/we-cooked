import { describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, Client, createMember, makeTestApp, sessionCount } from '../test/helpers.js';

describe('/admin lock', () => {
  it('starts locked and needs the shared password', async () => {
    const { app } = makeTestApp();
    const c = new Client(app);
    expect((await c.get('/api/admin/state')).json).toEqual({ unlocked: false, expiresAt: null });
    expect((await c.get('/api/admin/members')).status).toBe(401);

    expect((await c.post('/api/admin/unlock', { password: 'wrong' })).status).toBe(401);
    const ok = await c.post('/api/admin/unlock', { password: ADMIN_PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.json.expiresAt).toBeGreaterThan(Date.now() + 29 * 60 * 1000);
    const cookie = ok.headers.getSetCookie().find((x) => x.startsWith('wc_admin='))!;
    expect(cookie).toMatch(/Path=\/api\/admin/);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Max-Age=1800/);

    expect((await c.get('/api/admin/members')).status).toBe(200);
    await c.post('/api/admin/lock');
    expect((await c.get('/api/admin/members')).status).toBe(401);
  });

  it('locks out an address after 5 wrong passwords, even with the right one', async () => {
    const { app } = makeTestApp();
    const c = new Client(app);
    for (let i = 0; i < 5; i++) await c.post('/api/admin/unlock', { password: `guess-${i}` });
    expect((await c.post('/api/admin/unlock', { password: ADMIN_PASSWORD })).status).toBe(429);
  });

  it('is separate from member accounts', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac');
    // Signing in as a member does not unlock /admin.
    expect((await member.get('/api/admin/members')).status).toBe(401);
  });
});

describe('managing people', () => {
  it('lists members with their device count', async () => {
    const { app } = makeTestApp();
    const { admin } = await createMember(app, 'Issac');
    await createMember(app, 'Sam');
    const list = (await admin.get('/api/admin/members')).json;
    expect(list.map((m: any) => m.username)).toEqual(['Issac', 'Sam']);
    expect(list[0].devices).toBe(1);
    expect(list[0].lastActiveAt).toBeGreaterThan(0);
  });

  it('reset link: member picks a new password, old devices are signed out, notice shows once', async () => {
    const { app, db } = makeTestApp();
    const { admin, member, id } = await createMember(app, 'Sam', 'old-password');

    const first = await admin.post(`/api/admin/members/${id}/reset-link`);
    const second = await admin.post(`/api/admin/members/${id}/reset-link`);
    const firstToken = first.json.url.split('/reset/')[1];
    const token = second.json.url.split('/reset/')[1];
    // Only the newest link works.
    expect((await new Client(app).get(`/api/auth/reset/${firstToken}`)).status).toBe(410);
    expect((await new Client(app).get(`/api/auth/reset/${token}`)).json).toEqual({ valid: true, username: 'Sam' });

    const device = new Client(app);
    const done = await device.post('/api/auth/reset', { token, password: 'brand-new-pass' });
    expect(done.status).toBe(200);
    expect(done.json.user.passwordResetAt).toBeGreaterThan(0);
    expect((await member.get('/api/auth/me')).json.user).toBeNull();
    expect(sessionCount(db, id)).toBe(1);

    expect((await new Client(app).post('/api/auth/reset', { token, password: 'another-one!' })).status).toBe(410);
    expect((await new Client(app).post('/api/auth/login', { username: 'Sam', password: 'brand-new-pass' })).status).toBe(200);

    await device.post('/api/me/notice/dismiss');
    expect((await device.get('/api/auth/me')).json.user.passwordResetAt).toBeNull();

    const log = (await admin.get('/api/admin/log')).json.map((e: any) => e.message);
    expect(log[0]).toBe('Sam set a new password with a reset link');
    expect(log).toContain('Password reset link created for Sam');
  });

  it('signs out all devices of a member', async () => {
    const { app } = makeTestApp();
    const { admin, member, id } = await createMember(app, 'Sam');
    expect((await admin.post(`/api/admin/members/${id}/sign-out`)).json.signedOut).toBe(1);
    expect((await member.get('/api/auth/me')).json.user).toBeNull();
  });

  it('removes a member', async () => {
    const { app, db } = makeTestApp();
    const { admin, member, id } = await createMember(app, 'Sam');
    expect((await admin.del(`/api/admin/members/${id}`)).status).toBe(200);
    expect((await member.get('/api/auth/me')).json.user).toBeNull();
    expect(sessionCount(db, id)).toBe(0);
    expect((await admin.get('/api/admin/members')).json).toEqual([]);
  });

  it('cancels an unused invite', async () => {
    const { app } = makeTestApp();
    const admin = new Client(app);
    await admin.post('/api/admin/unlock', { password: ADMIN_PASSWORD });
    const invite = (await admin.post('/api/admin/invites')).json;
    expect((await admin.del(`/api/admin/invites/${invite.id}`)).status).toBe(200);
    const token = invite.url.split('/join/')[1];
    expect((await new Client(app).get(`/api/auth/join/${token}`)).status).toBe(410);
  });
});
