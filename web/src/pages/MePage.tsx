import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { DeviceSession, MeResponse } from '@wecooked/shared';
import { api, fieldError, formError } from '../lib/api';
import { useLogout, useMe, useSetMe } from '../lib/session';
import { Alert, Button, Card, TextField, relativeDay } from '../components/ui';
import { ApiKeysCard } from './me/ApiKeysCard';
import { ThemeSwitch } from '../components/ThemeSwitch';

function UsernameCard() {
  const { me } = useMe();
  const setMe = useSetMe();
  const [username, setUsername] = useState(me?.username ?? '');
  useEffect(() => setUsername(me?.username ?? ''), [me?.username]);
  const save = useMutation({
    mutationFn: () => api.patch('/me', { username }, MeResponse),
    onSuccess: (data) => setMe(data.user),
  });
  const unchanged = username.trim() === me?.username;
  return (
    <Card>
      <h2 className="text-lg font-bold">Username</h2>
      <p className="text-muted">Used to sign in and shown on your recipes and notes.</p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        noValidate
      >
        <TextField label="Username" className="min-w-[220px] flex-1" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} error={fieldError(save.error, 'username')} />
        <Button type="submit" busy={save.isPending} disabled={unchanged}>
          Save
        </Button>
      </form>
      {formError(save.error) && <div className="mt-3"><Alert>{formError(save.error)}</Alert></div>}
      {save.isSuccess && unchanged && <p className="mt-3 text-[13px] text-accent-ink" role="status">Saved.</p>}
    </Card>
  );
}

function PasswordCard() {
  const qc = useQueryClient();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNext] = useState('');
  const change = useMutation({
    mutationFn: () => api.post('/me/password', { currentPassword, newPassword }, z.object({ signedOut: z.number() })),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      qc.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
  return (
    <Card>
      <h2 className="text-lg font-bold">Password</h2>
      <p className="text-muted">Changing it signs out your other devices. This one stays signed in.</p>
      <form
        className="mt-4 flex flex-col gap-3 sm:max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate();
        }}
        noValidate
      >
        {formError(change.error) && <Alert>{formError(change.error)}</Alert>}
        <TextField label="Current password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} error={fieldError(change.error, 'currentPassword')} />
        <TextField label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNext(e.target.value)} error={fieldError(change.error, 'newPassword')} hint="At least 8 characters." />
        <Button type="submit" busy={change.isPending} className="self-start">
          Change password
        </Button>
        {change.isSuccess && (
          <p className="text-[13px] text-accent-ink" role="status">
            Password changed. {change.data.signedOut ? `${change.data.signedOut} other device(s) signed out.` : ''}
          </p>
        )}
      </form>
    </Card>
  );
}

function DevicesCard() {
  const qc = useQueryClient();
  const devices = useQuery({ queryKey: ['sessions'], queryFn: () => api.get('/me/sessions', z.array(DeviceSession)) });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/me/sessions/${id}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
  return (
    <Card>
      <h2 className="text-lg font-bold">Signed-in devices</h2>
      <p className="text-muted">Each stays signed in until it’s unused for a year, or you sign it out here.</p>
      <ul className="mt-3 flex flex-col">
        {devices.data?.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 first:border-t-0">
            <span className="flex flex-col">
              <span className="font-semibold">
                {d.device} {d.current && <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink">This device</span>}
              </span>
              <span className="text-[13px] text-muted">
                Signed in {relativeDay(d.createdAt).toLowerCase()} · last used {relativeDay(d.lastSeenAt).toLowerCase()}
              </span>
            </span>
            {!d.current && (
              <Button variant="secondary" size="sm" busy={remove.isPending && remove.variables === d.id} onClick={() => remove.mutate(d.id)}>
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
      {devices.isError && <Alert>{formError(devices.error)}</Alert>}
    </Card>
  );
}

export function MePage() {
  const { me } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!me) return null;
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-9 font-bold tracking-tight">Me</h1>
          <p className="text-muted">Your own account. Everyone in the household has the same abilities.</p>
        </div>
        <Button variant="secondary" busy={logout.isPending} onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}>
          Sign out of this device
        </Button>
      </header>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Colour mode</h2>
          <p className="text-muted">Saved on this device only. Auto follows the device’s own setting.</p>
        </div>
        <ThemeSwitch className="w-full sm:w-72" />
      </Card>
      <UsernameCard />
      <PasswordCard />
      <DevicesCard />
      <ApiKeysCard />
    </div>
  );
}
