import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MeResponse, type Me } from '@wecooked/shared';
import { api } from './api';

export const ME_KEY = ['me'] as const;

/** The signed-in member, or null for guests. */
export function useMe() {
  const query = useQuery({
    queryKey: ME_KEY,
    queryFn: () => api.get('/auth/me', MeResponse),
    staleTime: 5 * 60_000,
  });
  return { me: query.data?.user ?? null, loading: query.isPending, query };
}

/** Call after any request that signs this device in or changes the member. */
export function useSetMe() {
  const qc = useQueryClient();
  return (user: Me | null) => {
    qc.setQueryData(ME_KEY, { user } satisfies MeResponse);
  };
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(ME_KEY, { user: null } satisfies MeResponse);
    },
  });
}
