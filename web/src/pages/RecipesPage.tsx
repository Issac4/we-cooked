import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router';
import { ChevronDown, ChevronLeft, Plus, Search, X } from 'lucide-react';
import type { Collection, RecipeCard, RecipeSort } from '@wecooked/shared';
import { colorHex, useCollections, useMembership } from '../lib/collections';
import { AddRecipesDialog, CollectionFormDialog, DeleteCollectionButton } from '../components/CollectionDialogs';
import { useCollectionHref } from '../components/SidebarCollections';
import { formatMinutes, useRecipeFilters, useRecipeList } from '../lib/recipes';
import { useMe } from '../lib/session';
import { formError } from '../lib/api';
import { RecipePhoto } from '../components/RecipePhoto';
import { ActiveFilterChips, FilterSheet, FiltersButton } from '../components/Filters';
import { Alert, Button } from '../components/ui';

const SORT_LABELS: Record<RecipeSort, string> = {
  new: 'Newest first',
  updated: 'Recently edited',
  title: 'A → Z',
  time: 'Quickest first',
};

function SearchBox() {
  const { q, setQuery } = useRecipeFilters();
  const [value, setValue] = useState(q);
  // Follow outside changes (Clear all, back button).
  useEffect(() => setValue(q), [q]);
  useEffect(() => {
    if (value === q) return;
    const t = setTimeout(() => setQuery(value), 250);
    return () => clearTimeout(t);
  }, [value, q, setQuery]);
  return (
    <div className="relative flex flex-1 items-center sm:flex-none">
      <label htmlFor="recipe-search" className="sr-only">
        Search recipes
      </label>
      <Search size={16} className="pointer-events-none absolute left-3.5 text-muted" aria-hidden="true" />
      <input
        id="recipe-search"
        type="search"
        placeholder="Search recipes, ingredients…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-11 w-full rounded-xl border border-line-strong bg-surface pr-3.5 pl-10 text-ink placeholder:text-muted sm:w-[280px]"
      />
    </div>
  );
}

function SortMenu() {
  const { sort, setSort } = useRecipeFilters();
  return (
    <div className="relative">
      <label htmlFor="recipe-sort" className="sr-only">
        Sort recipes
      </label>
      <select
        id="recipe-sort"
        value={sort}
        onChange={(e) => setSort(e.target.value as RecipeSort)}
        className="h-11 cursor-pointer appearance-none rounded-xl border border-line-strong bg-surface pr-9 pl-3.5 text-ink-2"
      >
        {Object.entries(SORT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-2" aria-hidden="true" />
    </div>
  );
}

function Card({ recipe, removeFrom }: { recipe: RecipeCard; removeFrom?: Collection }) {
  const time = formatMinutes((recipe.prepMins ?? 0) + (recipe.cookMins ?? 0));
  const membership = useMembership();
  return (
    <div className="relative flex">
      <Link
        to={`/recipes/${recipe.id}`}
        className="flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink no-underline transition hover:border-line-strong hover:shadow-sm"
      >
        <div className="relative">
          <RecipePhoto id={recipe.id} photo={recipe.coverPhoto} className="h-[150px] w-full" />
          {recipe.needsReview && (
            <span className="absolute top-2.5 left-2.5 rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn-ink">
              Added by AI · needs review
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 px-4 pt-3.5 pb-4">
          <div>
            <div className="text-base leading-[22px] font-semibold">{recipe.title}</div>
            {recipe.otherName && <div className="text-[13px] text-muted">{recipe.otherName}</div>}
          </div>
          {(time || recipe.servings) && (
            <div className="flex gap-3 text-[13px] text-ink-2">
              {time && <span>{time}</span>}
              {recipe.servings && <span>Serves {recipe.servings}</span>}
            </div>
          )}
          {recipe.tags.length > 0 && <div className="text-xs text-muted">{recipe.tags.map((t) => t.name).join(' · ')}</div>}
          {removeFrom && <span className="h-7" aria-hidden="true" />}
        </div>
      </Link>
      {removeFrom && (
        <button
          type="button"
          onClick={() => membership.mutate({ collectionId: removeFrom.id, recipeIds: [recipe.id], add: false })}
          disabled={membership.isPending}
          className="absolute bottom-3 left-4 cursor-pointer text-[13px] text-muted underline hover:text-danger"
        >
          Remove from {removeFrom.name}
        </button>
      )}
    </div>
  );
}

function CollectionHeader({ collection, onAdd }: { collection: Collection; onAdd: () => void }) {
  const { me } = useMe();
  const [editing, setEditing] = useState(false);
  const href = useCollectionHref();
  return (
    <div className="flex flex-col gap-2">
      <Link to={href(null)} className="flex items-center gap-1 self-start text-[13px] font-semibold no-underline">
        <ChevronLeft size={14} aria-hidden="true" /> All recipes
      </Link>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="size-3.5 rounded-[4px]" style={{ background: colorHex(collection.color) }} aria-hidden="true" />
        <h1 className="text-[28px] leading-9 font-bold tracking-tight">{collection.name}</h1>
      </div>
      {collection.description && <p className="text-ink-2">{collection.description}</p>}
      {me && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onAdd}>
            <Plus size={14} aria-hidden="true" /> Add recipes
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <DeleteCollectionButton collection={collection} />
        </div>
      )}
      <CollectionFormDialog open={editing} onClose={() => setEditing(false)} collection={collection} />
    </div>
  );
}

export function RecipesPage() {
  const { me } = useMe();
  const filters = useRecipeFilters();
  const list = useRecipeList();
  const collections = useCollections();
  const [sheet, setSheet] = useState(false);
  const [adding, setAdding] = useState(false);
  const total = list.data?.total ?? 0;
  const countLabel = `${total} ${total === 1 ? 'recipe' : 'recipes'}`;
  const collection = filters.collection ? collections.data?.find((c) => c.id === filters.collection) : undefined;

  // A deleted or mistyped collection: say so and show everything instead.
  const missing = filters.collection !== null && collections.isSuccess && !collections.isFetching && !collection;
  useEffect(() => {
    if (missing) {
      toast('That collection no longer exists. Showing all recipes.');
      filters.setCollection(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  return (
    <div className="flex flex-col gap-5">
      {!me && (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-ink-2">
          You are viewing as a guest. Recipes and notes are read-only. <Link to="/login" className="font-semibold">Sign in</Link> to add recipes, comment and plan meals.
        </p>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4">
        {collection ? (
          <div className="flex flex-col gap-1">
            <CollectionHeader collection={collection} onAdd={() => setAdding(true)} />
            <p className="text-muted">
              {list.isPending ? 'Loading…' : filters.hasFilters ? `${countLabel} of ${collection.recipeCount} match` : countLabel}
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-[28px] leading-9 font-bold tracking-tight">All recipes</h1>
            <p className="text-muted">{list.isPending ? 'Loading…' : countLabel}</p>
          </div>
        )}
        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          <SearchBox />
          <SortMenu />
          {me && !collection && (
            <Link to="/recipes/new" className="hidden h-11 items-center gap-2 rounded-xl bg-accent px-[18px] font-semibold text-white no-underline hover:text-white md:flex">
              <Plus size={16} aria-hidden="true" /> New recipe
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <FiltersButton count={filters.tags.length} onClick={() => setSheet(true)} />
        {collection && (
          <button
            type="button"
            onClick={() => filters.setCollection(null)}
            aria-label={`Leave collection ${collection.name}`}
            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-surface pr-2.5 pl-3.5 text-[13px] md:hidden"
          >
            <span className="size-2 rounded-[2px]" style={{ background: colorHex(collection.color) }} />
            {collection.name}
            <X size={14} aria-hidden="true" />
          </button>
        )}
        {filters.tags.length > 0 && <span className="hidden text-[13px] text-muted md:inline">Filtered by</span>}
        <ActiveFilterChips />
      </div>

      {list.isError && !missing && <Alert>{formError(list.error)}</Alert>}

      {list.isSuccess && total === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          {filters.hasFilters ? (
            <>
              <p className="text-base font-semibold">{collection ? `No matches in ${collection.name}` : 'No recipes match'}</p>
              <p className="text-muted">Try removing a filter or a word from the search.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={filters.clear}>
                  Clear filters
                </Button>
                {collection && (
                  <Button variant="secondary" onClick={() => filters.setCollection(null)}>
                    Search all recipes
                  </Button>
                )}
              </div>
            </>
          ) : collection ? (
            <>
              <p className="text-base font-semibold">Nothing in {collection.name} yet</p>
              <p className="text-muted">{me ? 'Pick recipes to add, or use “+ Collection” on any recipe.' : 'Nothing has been added yet.'}</p>
              {me && <Button onClick={() => setAdding(true)}>Add recipes</Button>}
            </>
          ) : (
            <>
              <p className="text-base font-semibold">No recipes yet</p>
              <p className="text-muted">{me ? 'Add the first one, or ask an AI agent to add some for you.' : 'Nothing has been added yet.'}</p>
              {me && (
                <Link to="/recipes/new" className="flex h-11 items-center rounded-xl bg-accent px-[18px] font-semibold text-white no-underline hover:text-white">
                  Add a recipe
                </Link>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5">
        {list.data?.recipes.map((r) => <Card key={r.id} recipe={r} removeFrom={me ? collection : undefined} />)}
      </div>

      <FilterSheet open={sheet} onClose={() => setSheet(false)} resultLabel={countLabel} />
      {collection && <AddRecipesDialog open={adding} onClose={() => setAdding(false)} collection={collection} />}
    </div>
  );
}
