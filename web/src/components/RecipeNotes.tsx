import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Comment } from '@wecooked/shared';
import { api, fieldError, formError } from '../lib/api';
import { useMe } from '../lib/session';
import { Avatar } from './AppShell';
import { Alert, Button, formatDate } from './ui';
import { HeartPicker, Hearts } from './Hearts';
import { recipeKey } from '../lib/recipes';

const notesKey = (recipeId: number) => ['comments', recipeId] as const;
type NoteInput = { body: string; rating: number | null };

/** Notes and the recipe's score (page header, cards, "Highest rated") change together. */
function useRefreshNotes(recipeId: number) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: notesKey(recipeId) });
    qc.invalidateQueries({ queryKey: recipeKey(recipeId) });
    qc.invalidateQueries({ queryKey: ['recipes'] });
  };
}

function NoteBox({ initial = '', initialRating = null, label, submitLabel, busy, error, onSubmit, onCancel }: {
  initial?: string;
  initialRating?: number | null;
  label: string;
  submitLabel: string;
  busy: boolean;
  error: unknown;
  onSubmit: (note: NoteInput, reset: () => void) => void;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(initial);
  const [rating, setRating] = useState<number | null>(initialRating);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ body, rating }, () => (setBody(''), setRating(null)));
      }}
      noValidate
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-2">{label}</span>
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="e.g. Used 45 g rock sugar instead of 60 g, kids liked it better"
          className="rounded-[10px] border border-line-strong bg-page px-3 py-2.5 text-ink placeholder:text-muted"
        />
      </label>
      <HeartPicker value={rating} onChange={setRating} />
      {(fieldError(error, 'body') ?? formError(error)) && <Alert>{fieldError(error, 'body') ?? formError(error)}</Alert>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" busy={busy} disabled={!body.trim() && !rating}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Note({ note, recipeId }: { note: Comment; recipeId: number }) {
  const [editing, setEditing] = useState(false);
  const refresh = useRefreshNotes(recipeId);
  const edit = useMutation({ mutationFn: (n: NoteInput) => api.patch(`/comments/${note.id}`, n), onSuccess: () => { setEditing(false); refresh(); } });
  const remove = useMutation({ mutationFn: () => api.del(`/comments/${note.id}`), onSuccess: refresh });
  const author = note.author ?? 'A former member';

  return (
    <article className="flex gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
      <Avatar name={author} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
          <span>
            <strong className="font-semibold">{author}</strong>{' '}
            <span className="text-muted">
              · {formatDate(note.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
              {note.editedAt ? ' · edited' : ''}
            </span>
            {note.rating && (
              <span className="ml-1.5">
                <Hearts value={note.rating} />
              </span>
            )}
          </span>
          {note.mine && !editing && (
            <span className="flex gap-3">
              <button type="button" onClick={() => setEditing(true)} className="cursor-pointer text-muted hover:text-ink">
                Edit
              </button>
              <button
                type="button"
                onClick={() => window.confirm('Delete this note?') && remove.mutate()}
                className="cursor-pointer text-muted hover:text-danger"
              >
                Delete
              </button>
            </span>
          )}
        </div>
        {editing ? (
          <NoteBox
            initial={note.body}
            initialRating={note.rating}
            label="Edit your note"
            submitLabel="Save"
            busy={edit.isPending}
            error={edit.error}
            onSubmit={(n) => edit.mutate(n)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          note.body && <p className="whitespace-pre-line text-ink-2">{note.body}</p>
        )}
        {remove.isError && <Alert>{formError(remove.error)}</Alert>}
      </div>
    </article>
  );
}

/** "Notes from the kitchen": newest first, with the box to add one at the top. */
export function RecipeNotes({ recipeId }: { recipeId: number }) {
  const { me } = useMe();
  const refresh = useRefreshNotes(recipeId);
  const location = useLocation();
  const notes = useQuery({ queryKey: notesKey(recipeId), queryFn: () => api.get(`/recipes/${recipeId}/comments`, z.array(Comment)) });
  const add = useMutation({
    mutationFn: (n: NoteInput) => api.post(`/recipes/${recipeId}/comments`, n, Comment),
    onSuccess: refresh,
  });

  return (
    <section className="flex max-w-[760px] flex-col gap-3.5" aria-labelledby="notes-title">
      <h2 id="notes-title" className="text-lg font-bold">
        Notes from the kitchen <span className="text-sm font-medium text-muted">{notes.data?.length ?? ''}</span>
      </h2>
      {me ? (
        <div className="rounded-2xl border border-line-strong bg-surface px-4 py-3.5">
          <NoteBox
            label="Add a note: a brand that worked, a tweak, what to try next time, and your rating"
            submitLabel="Post note"
            busy={add.isPending}
            error={add.error}
            onSubmit={(n, reset) => add.mutate(n, { onSuccess: reset })}
          />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-3 text-ink-2">
          <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className="font-semibold">
            Sign in
          </Link>{' '}
          to add a note.
        </p>
      )}
      {notes.isError && <Alert>{formError(notes.error)}</Alert>}
      {notes.data?.length === 0 && <p className="text-muted">No notes yet.</p>}
      {notes.data?.map((n) => <Note key={n.id} note={n} recipeId={recipeId} />)}
    </section>
  );
}
