import { describe, expect, it } from 'vitest';
import { Client, createMember, makeTestApp, sessionCount } from '../test/helpers.js';

describe('Me page', () => {
  it('renames the member, who can then sign in with the new name', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac', 'correct-horse');
    const res = await member.patch('/api/me', { username: 'Dad' });
    expect(res.status).toBe(200);
    expect(res.json.user.username).toBe('Dad');
    expect((await member.get('/api/auth/me')).json.user.username).toBe('Dad');

    expect((await new Client(app).post('/api/auth/login', { username: 'dad', password: 'correct-horse' })).status).toBe(200);
    expect((await new Client(app).post('/api/auth/login', { username: 'Issac', password: 'correct-horse' })).status).toBe(401);
  });

  it('refuses a name someone else has', async () => {
    const { app } = makeTestApp();
    await createMember(app, 'Sam');
    const { member } = await createMember(app, 'Issac');
    expect((await member.patch('/api/me', { username: 'SAM' })).status).toBe(409);
    // Changing only the case of your own name is fine.
    expect((await member.patch('/api/me', { username: 'ISSAC' })).status).toBe(200);
  });

  it('changes the password and signs out the other devices only', async () => {
    const { app, db } = makeTestApp();
    const { member, id } = await createMember(app, 'Issac', 'old-password');
    const laptop = new Client(app);
    await laptop.post('/api/auth/login', { username: 'Issac', password: 'old-password' });

    const wrong = await member.post('/api/me/password', { currentPassword: 'nope', newPassword: 'new-password' });
    expect(wrong.status).toBe(400);
    expect(wrong.json.fields.currentPassword).toBeTruthy();

    const ok = await member.post('/api/me/password', { currentPassword: 'old-password', newPassword: 'new-password' });
    expect(ok.status).toBe(200);
    expect(ok.json.signedOut).toBe(1);
    expect(sessionCount(db, id)).toBe(1);
    expect((await member.get('/api/auth/me')).json.user).not.toBeNull();
    expect((await laptop.get('/api/auth/me')).json.user).toBeNull();
    expect((await new Client(app).post('/api/auth/login', { username: 'Issac', password: 'new-password' })).status).toBe(200);
  });

  it('lists devices and signs one out', async () => {
    const { app } = makeTestApp();
    const { member } = await createMember(app, 'Issac', 'pw-12345678');
    const laptop = new Client(app);
    await laptop.request('POST', '/api/auth/login', { username: 'Issac', password: 'pw-12345678' }, {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/130.0',
    });

    const list = (await member.get('/api/me/sessions')).json;
    expect(list).toHaveLength(2);
    expect(list.find((s: any) => s.current).device).toBe('iPhone · Safari');
    const mac = list.find((s: any) => !s.current);
    expect(mac.device).toBe('Mac · Chrome');

    expect((await member.del(`/api/me/sessions/${mac.id}`)).status).toBe(200);
    expect((await laptop.get('/api/auth/me')).json.user).toBeNull();
  });

  it('cannot sign out another member’s device', async () => {
    const { app } = makeTestApp();
    const { member: sam } = await createMember(app, 'Sam');
    const { member: issac } = await createMember(app, 'Issac');
    const samSession = (await sam.get('/api/me/sessions')).json[0].id;
    expect((await issac.del(`/api/me/sessions/${samSession}`)).status).toBe(404);
    expect((await sam.get('/api/auth/me')).json.user.username).toBe('Sam');
  });
});
