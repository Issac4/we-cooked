import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Lock } from 'lucide-react';
import { AdminInvite, AdminLink, AdminLogEntry, AdminMember, AdminState } from '@wecooked/shared';
import { api, ApiError, fieldError, formError } from '../lib/api';
import { Alert, Button, Card, TextField, formatDate, relativeDay } from '../components/ui';

const STATE_KEY = ['admin', 'state'];

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        if (await copy(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } else {
          window.prompt('Copy this link:', text);
        }
      }}
    >
      {done ? 'Copied' : label}
    </Button>
  );
}

function UnlockForm() {
  const qc = useQueryClient();
  const [password, setPassword] = useState('');
  const unlock = useMutation({
    mutationFn: () => api.post('/admin/unlock', { password }, AdminState),
    onSuccess: (state) => {
      setPassword('');
      qc.setQueryData(STATE_KEY, state);
    },
  });
  return (
    <main className="flex min-h-screen items-start justify-center px-4 pt-[14vh]">
      <form
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-surface p-6"
        onSubmit={(e) => {
          e.preventDefault();
          unlock.mutate();
        }}
        noValidate
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-ink text-page">
          <Lock size={20} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Household admin</h1>
          <p className="text-muted">Invites, password reset links and members. Opens with the shared admin password and locks itself after 30 minutes.</p>
        </div>
        {formError(unlock.error) && <Alert>{formError(unlock.error)}</Alert>}
        {/* No username: this is a shared key, so the browser should not file it under a member. */}
        <TextField label="Admin password" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldError(unlock.error, 'password')} />
        <Button type="submit" busy={unlock.isPending}>
          Unlock
        </Button>
        <Link to="/" className="text-center text-[13px]">
          Back to recipes
        </Link>
      </form>
    </main>
  );
}

function useAdminQuery<T>(key: string, path: string, schema: z.ZodType<T>) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['admin', key],
    queryFn: async () => {
      try {
        return await api.get(path, schema);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) qc.invalidateQueries({ queryKey: STATE_KEY });
        throw err;
      }
    },
  });
}

function Dashboard({ expiresAt }: { expiresAt: number }) {
  const qc = useQueryClient();
  const now = useNow(15_000);
  const minutesLeft = Math.max(0, Math.ceil((expiresAt - now) / 60_000));
  useEffect(() => {
    if (expiresAt <= now) qc.invalidateQueries({ queryKey: STATE_KEY });
  }, [expiresAt, now, qc]);

  const members = useAdminQuery('members', '/admin/members', z.array(AdminMember));
  const invites = useAdminQuery('invites', '/admin/invites', z.array(AdminInvite));
  const log = useAdminQuery('log', '/admin/log', z.array(AdminLogEntry));
  const [link, setLink] = useState<{ title: string; url: string; hint: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const lock = useMutation({
    mutationFn: () => api.post('/admin/lock', {}, AdminState),
    onSuccess: (s) => {
      qc.removeQueries({ queryKey: ['admin'] });
      qc.setQueryData(STATE_KEY, s);
    },
  });
  const createInvite = useMutation({
    mutationFn: () => api.post('/admin/invites', {}, AdminInvite),
    onSuccess: (inv) => {
      setLink({ title: 'New invite link', url: inv.url, hint: 'Send it to the person joining. They pick their own username and password. Works once, expires in 7 days.' });
      refresh();
    },
  });
  const cancelInvite = useMutation({ mutationFn: (id: number) => api.del(`/admin/invites/${id}`), onSettled: refresh });
  const resetLink = useMutation({
    mutationFn: (m: AdminMember) => api.post(`/admin/members/${m.id}/reset-link`, {}, AdminLink).then((l) => ({ l, m })),
    onSuccess: ({ l, m }) => {
      setLink({
        title: `Password reset link for ${m.username}`,
        url: l.url,
        hint: `Send it to ${m.username}. It works once, expires in 24 hours, and lets them choose their own new password. Nobody else learns it.`,
      });
      refresh();
    },
  });
  const signOut = useMutation({ mutationFn: (m: AdminMember) => api.post(`/admin/members/${m.id}/sign-out`), onSettled: refresh });
  const remove = useMutation({ mutationFn: (m: AdminMember) => api.del(`/admin/members/${m.id}`), onSettled: refresh });

  const actionError = [createInvite, cancelInvite, resetLink, signOut, remove].map((m) => formError(m.error)).find(Boolean);

  return (
    <div className="min-h-screen">
      <header className="bg-ink text-page">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-3 px-6 py-3.5">
          <span className="flex items-center gap-2.5 font-bold">
            <Lock size={20} aria-hidden="true" /> We Cooked · Household admin
          </span>
          <span className="flex items-center gap-3 text-[13px]">
            <span className="opacity-80">Locks automatically in {minutesLeft} min</span>
            <button type="button" onClick={() => lock.mutate()} className="cursor-pointer rounded-lg border border-white/30 px-3 py-2 font-semibold">
              Lock now
            </button>
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-[960px] flex-col gap-7 px-6 pt-7 pb-14">
        <Alert tone="info">This page only manages people. It opens with the shared admin password and is not anyone’s account, so every member stays equal.</Alert>
        {actionError && <Alert>{actionError}</Alert>}

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Members</h2>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="text-left text-xs tracking-wide text-muted uppercase">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3 font-semibold">Signed-in devices</th>
                  <th className="px-4 py-3 font-semibold">Last active</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.data?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="border-t border-line px-4 py-4 text-muted">
                      No members yet. Create an invite link below and open it yourself to make the first account.
                    </td>
                  </tr>
                )}
                {members.data?.map((m) => (
                  <tr key={m.id} className="border-t border-line">
                    <td className="px-4 py-3 font-semibold">{m.username}</td>
                    <td className="px-4 py-3 text-ink-2">{formatDate(m.createdAt)}</td>
                    <td className="px-4 py-3 text-ink-2">{m.devices}</td>
                    <td className="px-4 py-3 text-ink-2">{relativeDay(m.lastActiveAt)}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => resetLink.mutate(m)}>
                          Password reset link
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => signOut.mutate(m)}>
                          Sign out devices
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (window.confirm(`Remove ${m.username}? Their recipes and notes stay; they can no longer sign in.`)) remove.mutate(m);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {link && (
            <div className="flex flex-col gap-2.5 rounded-xl bg-accent-soft p-4" role="status">
              <span className="font-semibold text-accent-ink">{link.title}</span>
              <div className="flex flex-wrap gap-2">
                <code className="min-w-0 flex-[1_1_360px] rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[13px] break-all">{link.url}</code>
                <CopyButton text={link.url} label="Copy link" />
              </div>
              <span className="text-[13px] text-accent-ink">{link.hint}</span>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Invites</h2>
            <Button busy={createInvite.isPending} onClick={() => createInvite.mutate()}>
              Create invite link
            </Button>
          </div>
          <Card className="!p-0">
            {invites.data?.length === 0 && <p className="p-4 text-muted">No open invites. Each link works once and expires after 7 days.</p>}
            {invites.data?.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-4 py-3 last:border-b-0">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-mono text-[13px]">{inv.url}</span>
                  <span className="text-xs text-muted">
                    Created {formatDate(inv.createdAt, { day: 'numeric', month: 'short' })} · expires {formatDate(inv.expiresAt, { day: 'numeric', month: 'short' })} · unused
                  </span>
                </span>
                <span className="flex gap-1.5">
                  <CopyButton text={inv.url} />
                  <Button variant="danger" size="sm" onClick={() => cancelInvite.mutate(inv.id)}>
                    Cancel
                  </Button>
                </span>
              </div>
            ))}
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">Activity</h2>
          <ol className="m-0 list-none rounded-2xl border border-line bg-surface p-0">
            {log.data?.length === 0 && <li className="p-4 text-muted">Nothing yet.</li>}
            {log.data?.map((e) => (
              <li key={e.id} className="flex gap-4 border-b border-line px-4 py-2.5 last:border-b-0">
                <span className="w-[130px] shrink-0 text-[13px] text-muted">
                  {formatDate(e.at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>{e.message}</span>
              </li>
            ))}
          </ol>
          <p className="text-[13px] text-muted">A member whose password was reset also sees a notice when they next open the app, so nothing happens silently.</p>
        </section>
      </main>
    </div>
  );
}

export function AdminPage() {
  const state = useQuery({ queryKey: STATE_KEY, queryFn: () => api.get('/admin/state', AdminState), refetchInterval: 60_000 });
  if (state.isPending) return null;
  if (state.isError) return <main className="p-8"><Alert>{formError(state.error)}</Alert></main>;
  return state.data.unlocked && state.data.expiresAt ? <Dashboard expiresAt={state.data.expiresAt} /> : <UnlockForm />;
}
