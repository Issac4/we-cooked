import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Plus } from 'lucide-react';
import { colorHex, useCollections } from '../lib/collections';
import { useMe } from '../lib/session';
import { formError } from '../lib/api';
import { CollectionFormDialog } from '../components/CollectionDialogs';
import { Alert, Button } from '../components/ui';

/** Phone tab (also reachable on desktop): every collection as a row. */
export function CollectionsPage() {
  const { me } = useMe();
  const collections = useCollections();
  const [creating, setCreating] = useState(false);
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-9 font-bold tracking-tight">Collections</h1>
          <p className="text-muted">Themes you group recipes into.</p>
        </div>
        {me && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" /> New collection
          </Button>
        )}
      </header>
      {collections.isError && <Alert>{formError(collections.error)}</Alert>}
      {collections.data?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line-strong bg-surface p-6 text-center text-muted">No collections yet.</p>
      )}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {collections.data?.map((c) => (
          <li key={c.id}>
            <Link to={`/?collection=${c.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-ink no-underline hover:border-line-strong hover:text-ink">
              <span className="size-3.5 shrink-0 rounded-[4px]" style={{ background: colorHex(c.color) }} aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{c.name}</span>
                {c.description && <span className="truncate text-[13px] text-muted">{c.description}</span>}
              </span>
              <span className="text-[13px] text-muted">
                {c.recipeCount} {c.recipeCount === 1 ? 'recipe' : 'recipes'}
              </span>
              <ChevronRight size={16} className="text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <CollectionFormDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
