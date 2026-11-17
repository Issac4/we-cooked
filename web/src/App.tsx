import { useQuery } from '@tanstack/react-query';
import { APP_NAME, HealthResponse } from '@wecooked/shared';

async function fetchHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`Server answered ${res.status}`);
  return HealthResponse.parse(await res.json());
}

/** Placeholder home page for the skeleton milestone. */
export function App() {
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-white">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 11h18" />
          <path d="M5 11v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6" />
          <path d="M9 7c0-1 .5-2 1-2.5" />
          <path d="M14 7c0-1 .5-2 1-2.5" />
        </svg>
      </span>
      <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
      <p className="text-muted">Version 2 is being built. The recipes come next.</p>
      <p className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink-2" role="status">
        {health.isPending && 'Checking the server…'}
        {health.isError && `Server unreachable: ${health.error.message}`}
        {health.isSuccess && `Server OK · ${health.data.version}`}
      </p>
    </main>
  );
}
