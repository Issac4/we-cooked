import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Comment } from '@wecooked/shared';
import { api, fieldError, formError } from '../lib/api';
import { useMe } from '../lib/session';
import { Avatar } from './AppShell';
import { Alert, Button, formatDate } from './ui';

const notesKey = (recipeId: number) => ['comments', recipeId] as const;

function NoteBox({ initial = '', label, submitLabel, busy, error, onSubmit, onCancel }: {
  initial?: string;
  label: string;
  submitLabel: string;
  busy: boolean;
  error: unknown;
  onSubmit: (body: string, reset: () => void) => void;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(initial);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(body, () => setBody(''));
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
      {(fieldError(error, 'body') ?? formError(error)) && <Alert>{fieldError(error, 'body') ?? formError(error)}</Alert>}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" busy={busy} disabled={!body.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Note({ note, recipeId }: { note: Comment; recipeId: number }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: notesKey(recipeId) });
  const edit = useMutation({ mutationFn: (body: string) => api.patch(`/comments/${note.id}`, { body }), onSuccess: () => { setEditing(false); refresh(); } });
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
            label="Edit your note"
            submitLabel="Save"
            busy={edit.isPending}
            error={edit.error}
            onSubmit={(body) => edit.mutate(body)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <p className="whitespace-pre-line text-ink-2">{note.body}</p>
        )}
        {remove.isError && <Alert>{formError(remove.error)}</Alert>}
      </div>
    </article>
  );
}

/** "Notes from the kitchen": newest first, with the box to add one at the top. */
export function RecipeNotes({ recipeId }: { recipeId: number }) {
  const { me } = useMe();
  const qc = useQueryClient();
  const location = useLocation();
  const notes = useQuery({ queryKey: notesKey(recipeId), queryFn: () => api.get(`/recipes/${recipeId}/comments`, z.array(Comment)) });
  const add = useMutation({
    mutationFn: (body: string) => api.post(`/recipes/${recipeId}/comments`, { body }, Comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey(recipeId) }),
  });

  return (
    <section className="flex max-w-[760px] flex-col gap-3.5" aria-labelledby="notes-title">
      <h2 id="notes-title" className="text-lg font-bold">
        Notes from the kitchen <span className="text-sm font-medium text-muted">{notes.data?.length ?? ''}</span>
      </h2>
      {me ? (
        <div className="rounded-2xl border border-line-strong bg-surface px-4 py-3.5">
          <NoteBox
            label="Add a note: a brand that worked, a tweak, what to try next time"
            submitLabel="Post note"
            busy={add.isPending}
            error={add.error}
            onSubmit={(body, reset) => add.mutate(body, { onSuccess: reset })}
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
