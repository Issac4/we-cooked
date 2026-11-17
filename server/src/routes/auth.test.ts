import { describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, Client, createMember, makeTestApp, sessionCount } from '../test/helpers.js';

describe('guests', () => {
  it('are told they are not signed in', async () => {
    const { app } = makeTestApp();
    const res = await new Client(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ user: null });
  });

  it('cannot change account data', async () => {
    const { app } = makeTestApp();
    const guest = new Client(app);
    expect((await guest.patch('/api/me', { username: 'x' })).status).toBe(401);
    expect((await guest.get('/api/me/sessions')).status).toBe(401);
  });
});

describe('joining with an invite', () => {
  it('creates a signed-in member and uses up the link', async () => {
    const { app } = makeTestApp();
    const admin = new Client(app);
    await admin.post('/api/admin/unlock', { password: ADMIN_PASSWORD });
    const invite = await admin.post('/api/admin/invites');
    expect(invite.status).toBe(201);
    expect(invite.json.url).toMatch(/^https:\/\/wecooked\.test\/join\//);
    const token = invite.json.url.split('/join/')[1];

    const visitor = new Client(app);
    expect((await visitor.get(`/api/auth/join/${token}`)).json).toEqual({ valid: true });
    const joined = await visitor.post('/api/auth/join', { token, username: 'Issac', password: 'password-123' });
    expect(joined.status).toBe(201);
    expect(visitor.cookies.has('wc_session')).toBe(true);
    expect((await visitor.get('/api/auth/me')).json.user.username).toBe('Issac');

    // Used links stop working, and no longer show in /admin.
    expect((await new Client(app).get(`/api/auth/join/${token}`)).status).toBe(410);
    const again = await new Client(app).post('/api/auth/join', { token, username: 'Other', password: 'password-123' });
    expect(again.status).toBe(410);
    expect((await admin.get('/api/admin/invites')).json).toEqual([]);
  });

  it('rejects a username that only differs in case', async () => {
    const { app } = makeTestApp();
    await createMember(app, 'Sam');
    const admin = new Client(app);
    await admin.post('/api/admin/unlock', { password: ADMIN_PASSWORD });
    const token = (await admin.post('/api/admin/invites')).json.url.split('/join/')[1];
    const res = await new Client(app).post('/api/auth/join', { token, username: 'sAM', password: 'password-123' });
    expect(res.status).toBe(409);
    expect(res.json.fields.username).toMatch(/taken/);
  });

  it('validates username and password with field messages', async () => {
    const { app } = makeTestApp();
    const res = await new Client(app).post('/api/auth/join', { token: 'x', username: 'a', password: 'short' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.json.fields).sort()).toEqual(['password', 'username']);
  });

  it('accepts Chinese usernames', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, '阿明');
    expect((await member.get('/api/auth/me')).json.user.username).toBe('阿明');
  });
});

describe('signing in', () => {
  it('works with any letter case and keeps the device signed in', async () => {
    const { app } = makeTestApp();
    await createMember(app, 'Issac', 'correct-horse');
    const phone = new Client(app);
    const res = await phone.post('/api/auth/login', { username: 'issac', password: 'correct-horse' });
    expect(res.status).toBe(200);
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith('wc_session='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/Max-Age=31536000/);
  });

  it('says the same thing for a wrong username or a wrong password', async () => {
    const { app } = makeTestApp();
    await createMember(app, 'Issac', 'correct-horse');
    const a = await new Client(app).post('/api/auth/login', { username: 'nobody', password: 'x' });
    const b = await new Client(app).post('/api/auth/login', { username: 'Issac', password: 'wrong' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.json.error).toBe(b.json.error);
  });

  it('blocks after 10 wrong passwords for one username', async () => {
    const { app } = makeTestApp();
    await createMember(app, 'Issac', 'correct-horse');
    for (let i = 0; i < 10; i++) {
      await new Client(app).post('/api/auth/login', { username: 'Issac', password: `wrong-${i}` });
    }
    const res = await new Client(app).post('/api/auth/login', { username: 'Issac', password: 'correct-horse' });
    expect(res.status).toBe(429);
  });

  it('renews an old session and forgets an expired one', async () => {
    const { app, db } = makeTestApp();
    const { member, id } = await createMember(app, 'Issac');
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    db.$client.prepare('update sessions set last_seen_at = ?, expires_at = ? where user_id = ?').run(twoDaysAgo, Date.now() + 1000, id);

    const res = await member.get('/api/auth/me');
    expect(res.json.user.username).toBe('Issac');
    expect(res.headers.getSetCookie().some((c) => c.startsWith('wc_session='))).toBe(true);
    const row = db.$client.prepare('select expires_at from sessions where user_id = ?').get(id) as { expires_at: number };
    expect(row.expires_at).toBeGreaterThan(Date.now() + 364 * 24 * 60 * 60 * 1000);

    db.$client.prepare('update sessions set expires_at = ? where user_id = ?').run(Date.now() - 1, id);
    expect((await member.get('/api/auth/me')).json.user).toBeNull();
    expect(sessionCount(db, id)).toBe(0);
  });

  it('signs out only this device', async () => {
    const { app, db } = makeTestApp();
    const { member, id } = await createMember(app, 'Issac', 'correct-horse');
    const laptop = new Client(app);
    await laptop.post('/api/auth/login', { username: 'Issac', password: 'correct-horse' });
    expect(sessionCount(db, id)).toBe(2);
    await member.post('/api/auth/logout');
    expect((await member.get('/api/auth/me')).json.user).toBeNull();
    expect((await laptop.get('/api/auth/me')).json.user.username).toBe('Issac');
  });
});

describe('cross-site protection', () => {
  it('blocks writes whose Origin is another site', async () => {
    const { app } = makeTestApp();
    const evil = new Client(app, 'https://evil.example');
    const res = await evil.post('/api/auth/login', { username: 'a', password: 'b' });
    expect(res.status).toBe(403);
  });
});
