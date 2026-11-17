import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { Plus } from 'lucide-react';
import { colorHex, useCollections } from '../lib/collections';
import { useMe } from '../lib/session';
import { CollectionFormDialog } from './CollectionDialogs';

/** Link that opens a collection while keeping the current pills and search. */
function useCollectionHref() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  return (id: number | null) => {
    const next = new URLSearchParams(pathname === '/' ? params : undefined);
    if (id) next.set('collection', String(id));
    else next.delete('collection');
    const qs = next.toString();
    return qs ? `/?${qs}` : '/';
  };
}

export function SidebarCollections() {
  const { me } = useMe();
  const collections = useCollections();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const href = useCollectionHref();
  const [creating, setCreating] = useState(false);
  const active = pathname === '/' ? Number(params.get('collection') ?? 0) || null : undefined;

  const row = (isActive: boolean) =>
    `flex items-center justify-between gap-2 rounded-[10px] px-3 py-[9px] no-underline ${isActive ? 'bg-surface font-semibold text-ink' : 'text-ink-2 hover:bg-line/60 hover:text-ink'}`;

  return (
    <section className="flex flex-col gap-1.5" aria-labelledby="collections-heading">
      <div className="flex items-center justify-between px-1">
        <h2 id="collections-heading" className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">
          Collections
        </h2>
        {me && (
          <button type="button" aria-label="New collection" onClick={() => setCreating(true)} className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-line/60 hover:text-ink">
            <Plus size={16} />
          </button>
        )}
      </div>
      <Link to={href(null)} aria-current={active === null ? 'page' : undefined} className={row(active === null)}>
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="size-2.5 shrink-0 rounded-[3px] bg-ink-2" />
          All recipes
        </span>
      </Link>
      {collections.data?.map((c) => (
        <Link key={c.id} to={href(c.id)} aria-current={active === c.id ? 'page' : undefined} className={row(active === c.id)}>
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: colorHex(c.color) }} />
            <span className="truncate">{c.name}</span>
          </span>
          <span className="text-xs text-muted">{c.recipeCount}</span>
        </Link>
      ))}
      {me && collections.data?.length === 0 && (
        <button type="button" onClick={() => setCreating(true)} className="cursor-pointer px-3 py-1 text-left text-[13px] text-muted hover:text-ink">
          Group recipes into themes, like “Weeknight” or “CNY”.
        </button>
      )}
      <CollectionFormDialog open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}

export { useCollectionHref };
