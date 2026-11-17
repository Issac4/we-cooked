import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Recipe } from '@wecooked/shared';
import { api, ApiError, formError } from '../../lib/api';
import { recipeKey, useRecipe, useTagGroups } from '../../lib/recipes';
import { Alert, Button, TextField, relativeDay } from '../../components/ui';
import { CoverPhoto, IngredientsEditor, LinksEditor, SectionCard, StepsEditor, TagPicker } from './parts';
import { emptyForm, formFromRecipe, toInput, translatePath, type FormErrors, type FormState } from './state';

interface Draft {
  savedAt: number;
  baseUpdatedAt: number | null;
  form: FormState;
}

const draftKey = (id: number | null) => `wc-draft:${id ?? 'new'}`;

function readDraft(id: number | null): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function writeDraft(id: number | null, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(draftKey(id), JSON.stringify(draft));
    else localStorage.removeItem(draftKey(id));
  } catch {
    /* private mode or full storage: drafts are a convenience only */
  }
}

function Form({ recipe }: { recipe: Recipe | null }) {
  const id = recipe?.id ?? null;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const groups = useTagGroups();
  const [form, setFormState] = useState<FormState>(() => (recipe ? formFromRecipe(recipe) : emptyForm()));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [draft, setDraft] = useState<Draft | null>(() => readDraft(id));
  // The version this edit started from; a newer save by someone else makes ours conflict.
  const [baseUpdatedAt] = useState(() => recipe?.updatedAt ?? null);
  const saved = useRef(false);

  const setForm = (update: (f: FormState) => FormState) => {
    setFormState(update);
    setDirty(true);
  };

  // Keep an unsaved copy on this device so a closed tab or lost connection loses nothing.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => writeDraft(id, { savedAt: Date.now(), baseUpdatedAt, form }), 400);
    return () => clearTimeout(t);
  }, [form, dirty, id, baseUpdatedAt]);

  const save = useMutation({
    mutationFn: async () => {
      const { input, errors: found, pathKeys } = toInput(form);
      if (!input) {
        setErrors(found);
        throw new ApiError(400, 'Please check the highlighted fields');
      }
      setErrors({});
      try {
        return recipe
          ? await api.put(`/recipes/${recipe.id}`, { ...input, baseUpdatedAt }, Recipe)
          : await api.post('/recipes', input, Recipe);
      } catch (err) {
        if (err instanceof ApiError && Object.keys(err.fields).length) {
          const mapped: FormErrors = {};
          for (const [path, msg] of Object.entries(err.fields)) mapped[translatePath(path, pathKeys)] = msg;
          setErrors(mapped);
        }
        throw err;
      }
    },
    onSuccess: (r) => {
      saved.current = true;
      writeDraft(id, null);
      qc.setQueryData(recipeKey(r.id), r);
      qc.invalidateQueries({ queryKey: ['recipes'] });
      navigate(`/recipes/${r.id}`, { replace: true });
    },
  });

  // Warn before leaving with unsaved changes (the draft is still kept).
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saved.current && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Leave without saving? Your changes stay as a draft on this device.')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const topError = save.error instanceof ApiError && save.error.status === 409 ? save.error.message : formError(save.error);
  const hasFieldErrors = Object.keys(errors).length > 0;

  return (
    <form
      className="flex max-w-[860px] flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      noValidate
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] leading-9 font-bold tracking-tight">{recipe ? `Edit ${recipe.title}` : 'New recipe'}</h1>
      </header>

      {draft && !dirty && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warn-soft px-4 py-3 text-warn-ink">
          <span>
            You have unsaved changes from {relativeDay(draft.savedAt).toLowerCase()} on this device
            {recipe && draft.baseUpdatedAt !== baseUpdatedAt ? ' (the recipe has changed since)' : ''}.
          </span>
          <span className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setFormState(draft.form);
                setDirty(true);
                setDraft(null);
              }}
            >
              Restore
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                writeDraft(id, null);
                setDraft(null);
              }}
            >
              Discard
            </Button>
          </span>
        </div>
      )}

      <SectionCard title="Basics">
        <TextField label="Name" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} error={errors.title} placeholder="e.g. Soy Sauce Chicken" />
        <TextField
          label="Other name (optional)"
          value={form.otherName}
          onChange={(e) => setForm((f) => ({ ...f, otherName: e.target.value }))}
          error={errors.otherName}
          placeholder="e.g. 豉油雞"
          hint="Search matches both names."
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Description (optional)</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="A line or two about the dish"
            className="rounded-[10px] border border-line-strong bg-surface px-3 py-2.5 text-ink placeholder:text-muted"
          />
        </label>
        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          <TextField label="Serves" inputMode="numeric" value={form.servings} onChange={(e) => setForm((f) => ({ ...f, servings: e.target.value }))} error={errors.servings} />
          <TextField label="Prep (min)" inputMode="numeric" value={form.prepMins} onChange={(e) => setForm((f) => ({ ...f, prepMins: e.target.value }))} error={errors.prepMins} />
          <TextField label="Cook (min)" inputMode="numeric" value={form.cookMins} onChange={(e) => setForm((f) => ({ ...f, cookMins: e.target.value }))} error={errors.cookMins} />
        </div>
        <CoverPhoto value={form.coverPhoto} onChange={(coverPhoto) => setForm((f) => ({ ...f, coverPhoto }))} />
      </SectionCard>

      <SectionCard title="Filters" hint="Pick from each group. Add a new one with + New.">
        {groups.data ? <TagPicker groups={groups.data} value={form.tagIds} onChange={(tagIds) => setForm((f) => ({ ...f, tagIds }))} /> : null}
        {errors.tagIds && <Alert>{errors.tagIds}</Alert>}
      </SectionCard>

      <SectionCard title="Ingredients" hint="Amounts scale with the servings on the recipe page.">
        <IngredientsEditor sections={form.ingredients} setForm={setForm} errors={errors} />
      </SectionCard>

      <SectionCard title="Steps">
        <StepsEditor steps={form.steps} setForm={setForm} errors={errors} />
      </SectionCard>

      <SectionCard title="Source links (optional)" hint="Where the recipe came from: a video, a blog, a cookbook page.">
        <LinksEditor links={form.links} setForm={setForm} errors={errors} />
      </SectionCard>

      <div className="sticky bottom-[72px] z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-page/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-2xl md:border">
        {(topError || hasFieldErrors) && (
          <span role="alert" className="mr-auto text-danger">
            {topError ?? 'Please check the highlighted fields'}
          </span>
        )}
        <Link to={recipe ? `/recipes/${recipe.id}` : '/'} className="flex h-11 items-center px-3 font-semibold no-underline">
          Cancel
        </Link>
        <Button type="submit" busy={save.isPending}>
          {recipe ? 'Save changes' : 'Save recipe'}
        </Button>
      </div>
    </form>
  );
}

export function NewRecipePage() {
  return <Form recipe={null} />;
}

export function EditRecipePage() {
  const id = Number(useParams().id);
  const recipe = useRecipe(id, { fresh: true });
  if (recipe.isError) return <Alert>{formError(recipe.error)}</Alert>;
  if (!recipe.isFetchedAfterMount || !recipe.data) return null;
  return <Form key={id} recipe={recipe.data} />;
}
