import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { TrashItem } from '@wecooked/shared';
import { api, formError } from '../lib/api';
import { RecipePhoto } from '../components/RecipePhoto';
import { Alert, Button, formatDate } from '../components/ui';

export function TrashPage() {
  const qc = useQueryClient();
  const trash = useQuery({ queryKey: ['trash'], queryFn: () => api.get('/trash', z.array(TrashItem)) });
  const restore = useMutation({
    mutationFn: (id: number) => api.post(`/trash/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trash'] });
      qc.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-[28px] leading-9 font-bold tracking-tight">Trash</h1>
        <p className="text-muted">Deleted recipes stay here for 30 days. Anyone in the household can bring them back.</p>
      </div>
      {trash.isError && <Alert>{formError(trash.error)}</Alert>}
      {restore.isError && <Alert>{formError(restore.error)}</Alert>}
      {trash.data?.length === 0 && <p className="rounded-2xl border border-dashed border-line-strong bg-surface p-6 text-center text-muted">The Trash is empty.</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {trash.data?.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <RecipePhoto id={item.id} photo={item.coverPhoto} className="size-14 shrink-0 rounded-[10px]" iconSize={22} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{item.title}</span>
              <span className="text-[13px] text-muted">
                Deleted by {item.deletedBy ?? 'a former member'} on {formatDate(item.deletedAt)} · gone for good on {formatDate(item.purgeAt)}
              </span>
            </span>
            <Button variant="secondary" size="sm" busy={restore.isPending && restore.variables === item.id} onClick={() => restore.mutate(item.id)}>
              Restore
            </Button>
          </li>
        ))}
      </ul>
      {restore.isSuccess && (
        <p role="status" className="text-accent-ink">
          Restored. <Link to={`/recipes/${restore.variables}`}>Open it</Link>
        </p>
      )}
    </div>
  );
}
