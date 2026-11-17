import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MeResponse, TokenStatus } from '@wecooked/shared';
import { api, fieldError, formError } from '../lib/api';
import { useSetMe } from '../lib/session';
import { Alert, Button, Logo, TextField } from '../components/ui';

function AuthLayout({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-start justify-center px-4 pt-[12vh] pb-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link to="/" className="flex items-center gap-2.5 self-center text-ink no-underline">
          <Logo />
          <span className="text-lg font-bold tracking-tight">We Cooked</span>
        </Link>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {intro && <div className="mt-1 text-muted">{intro}</div>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </main>
  );
}

/** Only follow ?next= to a page on this site. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setMe = useSetMe();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useMutation({
    mutationFn: () => api.post('/auth/login', { username, password }, MeResponse),
    onSuccess: (data) => {
      setMe(data.user);
      navigate(safeNext(params.get('next')), { replace: true });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };

  return (
    <AuthLayout title="Sign in" intro="You only need to do this once on each device.">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {formError(login.error) && <Alert>{formError(login.error)}</Alert>}
        <TextField label="Username" autoComplete="username" autoCapitalize="none" autoCorrect="off" value={username} onChange={(e) => setUsername(e.target.value)} error={fieldError(login.error, 'username')} required />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldError(login.error, 'password')} required />
        <Button type="submit" busy={login.isPending}>
          Sign in
        </Button>
        <p className="text-[13px] text-muted">
          Forgot your password? Ask someone in your household to make you a reset link on the admin page.
        </p>
      </form>
      <p className="mt-5 border-t border-line pt-4 text-center text-[13px]">
        <Link to="/">Browse recipes without signing in</Link>
      </p>
    </AuthLayout>
  );
}

function BadLink({ what, error }: { what: string; error: unknown }) {
  return (
    <AuthLayout title={`This ${what} link does not work`}>
      <div className="flex flex-col gap-4">
        <Alert>{formError(error) ?? 'The link is not valid.'}</Alert>
        <Link to="/" className="text-center">
          Go to the recipes
        </Link>
      </div>
    </AuthLayout>
  );
}

export function JoinPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const setMe = useSetMe();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const check = useQuery({ queryKey: ['join', token], queryFn: () => api.get(`/auth/join/${token}`, TokenStatus), retry: false });
  const join = useMutation({
    mutationFn: () => api.post('/auth/join', { token, username, password }, MeResponse),
    onSuccess: (data) => {
      setMe(data.user);
      navigate('/', { replace: true });
    },
  });

  if (check.isPending) return null;
  if (check.isError) return <BadLink what="invite" error={check.error} />;

  return (
    <AuthLayout title="Join the household" intro="Pick the name others will see on your recipes and notes.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          join.mutate();
        }}
        className="flex flex-col gap-4"
        noValidate
      >
        {formError(join.error) && <Alert>{formError(join.error)}</Alert>}
        <TextField label="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} error={fieldError(join.error, 'username')} hint="Any language. You can change it later." required />
        <TextField label="Password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldError(join.error, 'password')} hint="At least 8 characters." required />
        <Button type="submit" busy={join.isPending}>
          Join
        </Button>
        <p className="text-[13px] text-muted">This device stays signed in, so you won’t be asked again here.</p>
      </form>
    </AuthLayout>
  );
}

export function ResetPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const setMe = useSetMe();
  const [password, setPassword] = useState('');
  const check = useQuery({ queryKey: ['reset', token], queryFn: () => api.get(`/auth/reset/${token}`, TokenStatus), retry: false });
  const reset = useMutation({
    mutationFn: () => api.post('/auth/reset', { token, password }, MeResponse),
    onSuccess: (data) => {
      setMe(data.user);
      navigate('/', { replace: true });
    },
  });

  if (check.isPending) return null;
  if (check.isError) return <BadLink what="reset" error={check.error} />;

  return (
    <AuthLayout title="Choose a new password" intro={<>For <strong className="text-ink">{check.data.username}</strong>. Your other devices will be signed out.</>}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          reset.mutate();
        }}
        className="flex flex-col gap-4"
        noValidate
      >
        {/* Lets password managers save the new password under the right username. */}
        <input type="text" name="username" autoComplete="username" value={check.data.username ?? ''} readOnly hidden />
        {formError(reset.error) && <Alert>{formError(reset.error)}</Alert>}
        <TextField label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fieldError(reset.error, 'password')} hint="At least 8 characters." required />
        <Button type="submit" busy={reset.isPending}>
          Save and sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
