import { NavLink, Outlet, Link } from 'react-router';
import { BookOpen, CalendarDays, House, LayoutGrid, Plus, Trash2, UserRound } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ME_KEY, useMe } from '../lib/session';
import { Logo, formatDate } from './ui';
import { SidebarFilters } from './Filters';

const navItem = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 no-underline ${
    isActive ? 'bg-accent-soft font-semibold text-accent-ink' : 'text-ink-2 hover:bg-line/60'
  }`;

function Sidebar() {
  const { me } = useMe();
  return (
    <aside className="hidden w-[260px] shrink-0 flex-col gap-7 overflow-y-auto border-r border-line bg-sidebar px-5 py-6 md:sticky md:top-0 md:flex md:h-screen">
      <Link to="/" className="flex items-center gap-2.5 text-ink no-underline">
        <Logo />
        <span className="text-lg font-bold tracking-tight">We Cooked</span>
      </Link>

      <nav aria-label="Main" className="flex flex-col gap-0.5">
        <NavLink to="/" end className={navItem}>
          <BookOpen size={18} aria-hidden="true" /> Recipes
        </NavLink>
        {me && (
          <>
            <NavLink to="/plan" className={navItem}>
              <CalendarDays size={18} aria-hidden="true" /> Meal plan
            </NavLink>
            <NavLink to="/settings" className={navItem}>
              <House size={18} aria-hidden="true" /> Household settings
            </NavLink>
          </>
        )}
      </nav>

      {/* Collections arrive with their milestone. */}
      <SidebarFilters />

      <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
        {me && (
          <NavLink to="/trash" className={({ isActive }) => `flex items-center gap-2 px-1 text-[13px] no-underline ${isActive ? 'font-semibold text-accent-ink' : 'text-muted hover:text-ink'}`}>
            <Trash2 size={14} aria-hidden="true" /> Trash
          </NavLink>
        )}
        {me ? (
          <NavLink to="/me" className="flex items-center gap-2.5 rounded-[10px] px-1 py-1.5 text-ink no-underline hover:bg-line/60">
            <Avatar name={me.username} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{me.username}</span>
              <span className="text-xs text-muted">Me · settings and API keys</span>
            </span>
          </NavLink>
        ) : (
          <Link to="/login" className="flex h-11 items-center justify-center rounded-[10px] bg-ink font-semibold text-page no-underline">
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}

function BottomTabs() {
  const { me } = useMe();
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex w-16 flex-col items-center gap-0.5 text-[11px] no-underline ${isActive ? 'font-semibold text-accent-ink' : 'text-muted'}`;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 flex h-[72px] items-center justify-around border-t border-line bg-surface px-2 pb-[max(8px,env(safe-area-inset-bottom))] md:hidden"
    >
      <NavLink to="/" end className={tab}>
        <BookOpen size={22} aria-hidden="true" /> Recipes
      </NavLink>
      {me ? (
        <>
          <NavLink to="/plan" className={tab}>
            <CalendarDays size={22} aria-hidden="true" /> Plan
          </NavLink>
          <Link
            to="/recipes/new"
            aria-label="New recipe"
            className="-mt-[18px] flex size-[52px] items-center justify-center rounded-full bg-accent text-white shadow-[0_6px_16px_rgba(47,107,79,0.35)]"
          >
            <Plus size={22} aria-hidden="true" />
          </Link>
          <NavLink to="/collections" className={tab}>
            <LayoutGrid size={22} aria-hidden="true" /> Collections
          </NavLink>
          <NavLink to="/me" className={tab}>
            <UserRound size={22} aria-hidden="true" /> Me
          </NavLink>
        </>
      ) : (
        <NavLink to="/login" className={tab}>
          <UserRound size={22} aria-hidden="true" /> Sign in
        </NavLink>
      )}
    </nav>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = [...name.trim()].slice(0, 2).join('').toUpperCase();
  return (
    <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-ink">
      {initials}
    </span>
  );
}

/** Shown on every page after /admin reset this member's password. */
function ResetNotice() {
  const { me } = useMe();
  const qc = useQueryClient();
  const dismiss = useMutation({
    mutationFn: () => api.post('/me/notice/dismiss'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_KEY }),
  });
  if (!me?.passwordResetAt) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warn-soft px-4 py-3 text-warn-ink">
      <span>
        Your password was reset on {formatDate(me.passwordResetAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} using
        a link from the admin page. If that was not you, tell your household.
      </span>
      <button type="button" onClick={() => dismiss.mutate()} className="cursor-pointer font-semibold underline">
        Got it
      </button>
    </div>
  );
}

export function AppShell() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex flex-1 flex-col gap-5 px-4 pt-6 pb-28 md:px-10 md:pt-8 md:pb-12">
          <ResetNotice />
          <Outlet />
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
