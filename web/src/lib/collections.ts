import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Collection, COLLECTION_COLORS, type CollectionColor, type CollectionInput } from '@wecooked/shared';
import { api } from './api';

export const collectionsKey = ['collections'] as const;

export function useCollections() {
  return useQuery({ queryKey: collectionsKey, queryFn: () => api.get('/collections', z.array(Collection)) });
}

export const colorHex = (c: CollectionColor) => COLLECTION_COLORS[c];

/** Refreshes everything that shows collection membership or counts. */
export function useRefreshCollections() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: collectionsKey });
    qc.invalidateQueries({ queryKey: ['recipes'] });
    qc.invalidateQueries({ queryKey: ['recipe'] });
  };
}

export function useSaveCollection(id?: number) {
  const qc = useQueryClient();
  const refresh = useRefreshCollections();
  return useMutation({
    mutationFn: (input: CollectionInput) => (id ? api.patch(`/collections/${id}`, input, Collection) : api.post('/collections', input, Collection)),
    onSuccess: (saved) => {
      // Put it in the list right away so opening it never races the refetch.
      qc.setQueryData<Collection[]>(collectionsKey, (list) => (list ? [...list.filter((c) => c.id !== saved.id), saved] : [saved]));
      refresh();
    },
  });
}

export function useMembership() {
  const refresh = useRefreshCollections();
  return useMutation({
    mutationFn: ({ collectionId, recipeIds, add }: { collectionId: number; recipeIds: number[]; add: boolean }) =>
      add
        ? api.post(`/collections/${collectionId}/recipes`, { recipeIds })
        : api.del(`/collections/${collectionId}/recipes/${recipeIds[0]}`),
    onSuccess: refresh,
  });
}
