import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import { COLLECTION_COLORS, RecipeList, type Collection, type CollectionColor } from '@wecooked/shared';
import { api, fieldError, formError } from '../lib/api';
import { colorHex, useMembership, useRefreshCollections, useSaveCollection } from '../lib/collections';
import { recipesKey, useAllRecipes } from '../lib/recipes';
import { Dialog } from './Dialog';
import { RecipePhoto } from './RecipePhoto';
import { Alert, Button, TextField } from './ui';

/** Create (no `collection`) or edit a collection. */
export function CollectionFormDialog({ open, onClose, collection }: { open: boolean; onClose: () => void; collection?: Collection }) {
  const navigate = useNavigate();
  const save = useSaveCollection(collection?.id);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<CollectionColor>('green');
  useEffect(() => {
    if (!open) return;
    setName(collection?.name ?? '');
    setDescription(collection?.description ?? '');
    setColor(collection?.color ?? 'green');
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, collection]);

  return (
    <Dialog open={open} onClose={onClose} title={collection ? 'Edit collection' : 'New collection'}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(
            { name, description, color },
            {
              onSuccess: (c) => {
                onClose();
                if (!collection) navigate(`/?collection=${c.id}`);
              },
            },
          );
        }}
        noValidate
      >
        <TextField label="Name" autoFocus value={name} onChange={(e) => setName(e.target.value)} error={fieldError(save.error, 'name')} placeholder="e.g. Weeknight 30-min, CNY 2027" />
        <TextField label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-semibold text-ink-2">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(COLLECTION_COLORS) as CollectionColor[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className="flex size-10 cursor-pointer items-center justify-center rounded-full text-white ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink"
                style={{ background: colorHex(c) }}
              >
                {color === c && <Check size={18} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="text-[13px] text-muted">Collections are themes you pick recipes into. Filters (Protein, Meal…) describe the dish itself.</p>
        {formError(save.error) && <Alert>{formError(save.error)}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={save.isPending}>
            {collection ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function DeleteCollectionButton({ collection }: { collection: Collection }) {
  const navigate = useNavigate();
  const refresh = useRefreshCollections();
  const del = useMutation({
    mutationFn: () => api.del(`/collections/${collection.id}`),
    onSuccess: () => {
      refresh();
      navigate('/');
    },
  });
  return (
    <Button
      variant="danger"
      size="sm"
      busy={del.isPending}
      onClick={() => {
        if (window.confirm(`Delete the “${collection.name}” collection? Its recipes stay in All recipes.`)) del.mutate();
      }}
    >
      Delete collection
    </Button>
  );
}

/** Searchable checklist for adding many recipes to a collection at once. */
export function AddRecipesDialog({ open, onClose, collection }: { open: boolean; onClose: () => void; collection: Collection }) {
  const all = useAllRecipes(open);
  const members = useQuery({
    queryKey: recipesKey({ collection: collection.id, all: true }),
    queryFn: () => api.get(`/recipes?collection=${collection.id}`, RecipeList),
    enabled: open,
  });
  const inCollection = useMemo(() => new Set(members.data?.recipes.map((r) => r.id) ?? []), [members.data]);
  const membership = useMembership();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (open) {
      setPicked(new Set());
      setQuery('');
      membership.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (all.data?.recipes ?? []).filter((r) => !q || `${r.title} ${r.otherName}`.toLowerCase().includes(q));
  }, [all.data, query]);

  const toggle = (id: number) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onClose={onClose} title={`Add recipes to ${collection.name}`} wide>
      <div className="relative flex items-center">
        <Search size={16} className="pointer-events-none absolute left-3.5 text-muted" aria-hidden="true" />
        <input
          type="search"
          aria-label="Search recipes"
          placeholder="Search recipes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 w-full rounded-xl border border-line-strong bg-surface pr-3 pl-10"
        />
      </div>
      <ul className="m-0 flex max-h-[50vh] list-none flex-col overflow-y-auto p-0">
        {visible.map((r) => {
          const already = inCollection.has(r.id);
          return (
            <li key={r.id}>
              <label className={`flex items-center gap-3 rounded-[10px] px-2 py-2 ${already ? 'opacity-60' : 'cursor-pointer hover:bg-sidebar'}`}>
                <input type="checkbox" className="size-[18px] accent-accent" checked={already || picked.has(r.id)} disabled={already} onChange={() => toggle(r.id)} />
                <RecipePhoto id={r.id} photo={r.coverPhoto} className="size-10 shrink-0 rounded-lg" iconSize={18} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{r.title}</span>
                  <span className="truncate text-xs text-muted">{already ? 'Already in this collection' : r.otherName}</span>
                </span>
              </label>
            </li>
          );
        })}
        {all.isSuccess && visible.length === 0 && <li className="p-3 text-muted">No recipes match.</li>}
      </ul>
      {formError(membership.error) && <Alert>{formError(membership.error)}</Alert>}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={picked.size === 0}
          busy={membership.isPending}
          onClick={() => membership.mutate({ collectionId: collection.id, recipeIds: [...picked], add: true }, { onSuccess: onClose })}
        >
          {picked.size ? `Add ${picked.size} ${picked.size === 1 ? 'recipe' : 'recipes'}` : 'Add recipes'}
        </Button>
      </div>
    </Dialog>
  );
}
