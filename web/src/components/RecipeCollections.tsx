import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import type { Recipe } from '@wecooked/shared';
import { colorHex, useCollections, useMembership } from '../lib/collections';
import { recipeKey } from '../lib/recipes';
import { useMe } from '../lib/session';
import { CollectionFormDialog } from './CollectionDialogs';

/** "In: [Weeknight] [Kids' favourites] [+ Collection]" on the recipe page. */
export function RecipeCollections({ recipe }: { recipe: Recipe }) {
  const { me } = useMe();
  const all = useCollections();
  const membership = useMembership();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const memberOf = new Set(recipe.collections.map((c) => c.id));
  // Ticks held locally until their save settles, so the box never flickers back.
  const [pending, setPending] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!recipe.collections.length && !me) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-muted">In</span>
      {recipe.collections.map((c) => (
        <Link
          key={c.id}
          to={`/?collection=${c.id}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-sidebar px-3 py-[5px] text-[13px] font-medium text-ink no-underline hover:text-ink"
        >
          <span className="size-2 rounded-[2px]" style={{ background: colorHex(c.color) }} aria-hidden="true" />
          {c.name}
        </Link>
      ))}
      {!recipe.collections.length && <span className="text-[13px] text-muted">no collection yet</span>}
      {me && (
        <div ref={box} className="relative">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-muted px-3 py-[5px] text-[13px] font-semibold text-ink-2"
          >
            <Plus size={13} aria-hidden="true" /> Collection
          </button>
          {open && (
            <div className="absolute top-full left-0 z-20 mt-1.5 flex w-64 flex-col gap-0.5 rounded-xl border border-line-strong bg-surface p-1.5 shadow-lg">
              {all.data?.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sidebar">
                  <input
                    type="checkbox"
                    className="size-[18px] accent-accent"
                    checked={pending[c.id] ?? memberOf.has(c.id)}
                    onChange={(e) => {
                      const add = e.target.checked;
                      setPending((p) => ({ ...p, [c.id]: add }));
                      // Show the change at once; a failed save puts it back.
                      qc.setQueryData<Recipe>(recipeKey(recipe.id), (r) =>
                        r ? { ...r, collections: add ? [...r.collections, { id: c.id, name: c.name, color: c.color }] : r.collections.filter((x) => x.id !== c.id) } : r,
                      );
                      membership.mutate(
                        { collectionId: c.id, recipeIds: [recipe.id], add },
                        {
                          onError: () => qc.invalidateQueries({ queryKey: recipeKey(recipe.id) }),
                          onSettled: () =>
                            setPending((p) => {
                              const { [c.id]: _done, ...rest } = p;
                              return rest;
                            }),
                        },
                      );
                    }}
                  />
                  <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: colorHex(c.color) }} aria-hidden="true" />
                  <span className="truncate">{c.name}</span>
                </label>
              ))}
              {all.data?.length === 0 && <p className="px-2 py-1.5 text-[13px] text-muted">No collections yet.</p>}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setCreating(true);
                }}
                className="mt-0.5 cursor-pointer rounded-lg border-t border-line px-2 py-2 text-left text-[13px] font-semibold text-accent hover:bg-sidebar"
              >
                + New collection…
              </button>
            </div>
          )}
        </div>
      )}
      <CollectionFormDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
