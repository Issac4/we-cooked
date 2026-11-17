import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Recipe, RecipeList, RECIPE_SORTS, TagGroup, type RecipeSort } from '@wecooked/shared';
import { api } from './api';

export const tagsKey = ['tags'] as const;
export const recipesKey = (params: object) => ['recipes', params] as const;
export const recipeKey = (id: number) => ['recipe', id] as const;

export function useTagGroups() {
  return useQuery({ queryKey: tagsKey, queryFn: () => api.get('/tags', z.array(TagGroup)), staleTime: 5 * 60_000 });
}

export function useRecipe(id: number, { fresh = false } = {}) {
  return useQuery({
    queryKey: recipeKey(id),
    queryFn: () => api.get(`/recipes/${id}`, Recipe),
    enabled: id > 0,
    // The editor needs the latest version, not a cached one.
    ...(fresh ? { refetchOnMount: 'always' as const } : {}),
  });
}

/**
 * The recipe list's filters live in the address (?tags=1,2&q=soy&sort=title),
 * so a filtered view can be bookmarked or shared and survives a refresh.
 */
export function useRecipeFilters() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const tags = useMemo(
    () =>
      (params.get('tags') ?? '')
        .split(',')
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0),
    [params],
  );
  const q = params.get('q') ?? '';
  const collection = Number(params.get('collection') ?? 0) || null;
  const sortParam = params.get('sort') ?? 'new';
  const sort: RecipeSort = (RECIPE_SORTS as readonly string[]).includes(sortParam) ? (sortParam as RecipeSort) : 'new';

  const update = useCallback(
    (change: (p: URLSearchParams) => void, push = false) => {
      const next = new URLSearchParams(location.pathname === '/' ? params : undefined);
      change(next);
      for (const [k, v] of [...next.entries()]) if (!v) next.delete(k);
      if (location.pathname === '/') setParams(next, { replace: !push });
      else navigate(`/?${next.toString()}`);
    },
    [location.pathname, navigate, params, setParams],
  );

  const toggleTag = (id: number) =>
    update((p) => {
      const set = new Set(tags);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      p.set('tags', [...set].join(','));
    });

  return {
    tags,
    q,
    sort,
    collection,
    hasFilters: tags.length > 0 || q.trim().length > 0,
    toggleTag,
    setQuery: (value: string) => update((p) => p.set('q', value)),
    setSort: (value: RecipeSort) => update((p) => p.set('sort', value === 'new' ? '' : value)),
    /** Clears pills and search; stays inside the current collection. */
    clear: () =>
      update((p) => {
        p.delete('tags');
        p.delete('q');
      }),
    /** Opens a collection (or All recipes with null), keeping pills and search. */
    setCollection: (id: number | null) => update((p) => p.set('collection', id ? String(id) : ''), true),
  };
}

/** Every recipe, for pickers. */
export function useAllRecipes(enabled = true) {
  return useQuery({ queryKey: recipesKey({ all: true }), queryFn: () => api.get('/recipes?sort=title', RecipeList), enabled });
}

export function useRecipeList() {
  const { tags, q, sort, collection } = useRecipeFilters();
  const params = { tags: tags.join(','), q: q.trim(), sort, collection: collection ? String(collection) : '' };
  return useQuery({
    queryKey: recipesKey(params),
    queryFn: () => {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
      return api.get(`/recipes?${qs.toString()}`, RecipeList);
    },
    // Keep showing the old list while typing or toggling pills, but never carry a list
    // into a different collection (its cards would offer "Remove from" wrongly).
    placeholderData: (prev, prevQuery) =>
      (prevQuery?.queryKey[1] as { collection?: string } | undefined)?.collection === params.collection ? prev : undefined,
  });
}

/** "45 min", "1 h 15 min". */
export function formatMinutes(mins: number | null | undefined): string {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const TINTS = ['#F2E2CF', '#F6EBC8', '#EFD9D2', '#E9E1D2', '#EDE7DA', '#DCE7E4', '#F4E4C9', '#F3EDC9'];
/** Stable warm placeholder colour for a recipe without a photo. */
export function tintFor(id: number): string {
  return TINTS[id % TINTS.length]!;
}
