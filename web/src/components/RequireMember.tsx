import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useMe } from '../lib/session';

/** Members-only page: guests get a friendly sign-in prompt instead. */
export function RequireMember({ children, what = 'This page' }: { children: ReactNode; what?: string }) {
  const { me, loading } = useMe();
  const location = useLocation();
  if (loading) return null;
  if (me) return <>{children}</>;
  const next = encodeURIComponent(location.pathname + location.search);
  return (
    <div className="mx-auto mt-20 flex max-w-md flex-col items-center gap-3 text-center">
      <h1 className="text-2xl font-bold">{what} is for household members</h1>
      <p className="text-muted">Recipes, collections and notes are public. Everything else needs you to sign in.</p>
      <Link to={`/login?next=${next}`} className="flex h-11 items-center rounded-[10px] bg-ink px-5 font-semibold text-page no-underline">
        Sign in
      </Link>
    </div>
  );
}
