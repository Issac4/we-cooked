import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ExternalLink, Minus, Plus, Timer } from 'lucide-react';
import { formatQuantity, photoUrl, type Recipe, type Step } from '@wecooked/shared';
import { api, formError } from '../lib/api';
import { formatMinutes, recipeKey, useRecipe } from '../lib/recipes';
import { useMe } from '../lib/session';
import { Markdown } from '../components/Markdown';
import { RecipePhoto } from '../components/RecipePhoto';
import { RecipeCollections } from '../components/RecipeCollections';
import { RecipeNotes } from '../components/RecipeNotes';
import { Alert, Button, formatDate } from '../components/ui';

function Ingredients({ recipe }: { recipe: Recipe }) {
  const base = recipe.servings;
  const [serves, setServes] = useState(base ?? 0);
  const factor = base ? serves / base : 1;
  const sections = recipe.ingredients;
  if (!sections.length) return null;
  return (
    <section className="flex w-full flex-col gap-3.5 rounded-2xl border border-line bg-surface p-5 lg:max-w-[360px]" aria-labelledby="ingredients-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="ingredients-title" className="text-lg font-bold">
          Ingredients
        </h2>
        {base ? (
          <div className="flex items-center gap-1 rounded-full border border-line-strong p-0.5">
            <button type="button" aria-label="Fewer servings" onClick={() => setServes((s) => Math.max(1, s - 1))} className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-sidebar">
              <Minus size={16} aria-hidden="true" />
            </button>
            <span className="min-w-[76px] text-center text-[13px] font-semibold" aria-live="polite">
              Serves {serves}
            </span>
            <button type="button" aria-label="More servings" onClick={() => setServes((s) => s + 1)} className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-sidebar">
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
      {sections.map((section, si) => (
        <div key={si} className="flex flex-col">
          {section.name && <h3 className="mt-1 mb-1 text-[13px] font-semibold tracking-wide text-muted uppercase">{section.name}</h3>}
          <ul className="m-0 flex list-none flex-col p-0">
            {section.items.map((item, ii) => {
              const amount = [formatQuantity(item.quantity === null ? null : item.quantity * factor), item.unit].filter(Boolean).join(' ');
              return (
                <li key={ii} className="flex gap-3 border-t border-line py-2.5 first:border-t-0">
                  <span className="w-[76px] shrink-0 font-semibold text-accent-ink">{amount}</span>
                  <span>
                    {item.name}
                    {item.note && <span className="text-muted">, {item.note}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {recipe.links.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-line pt-3">
          <span className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">Source</span>
          {recipe.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1.5 text-[13px] break-words">
              <ExternalLink size={13} className="mt-1 shrink-0" aria-hidden="true" />
              {l.title || new URL(l.url).hostname}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function StepTimer({ minutes }: { minutes: number }) {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const running = endAt !== null;
  const left = running ? Math.max(0, endAt - now) : minutes * 60_000;
  const mm = Math.floor(left / 60_000);
  const ss = Math.floor((left % 60_000) / 1000);
  const label = `${mm}:${String(ss).padStart(2, '0')}`;

  // Ticks only while running; stopping or leaving the page cancels it.
  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= endAt) {
        clearInterval(handle);
        toast.success(`Timer done: ${minutes} min`);
        navigator.vibrate?.([200, 100, 200]);
      }
    };
    const handle = setInterval(tick, 500);
    tick();
    return () => clearInterval(handle);
  }, [endAt, minutes]);

  return (
    <button
      type="button"
      onClick={() => setEndAt(running ? null : Date.now() + minutes * 60_000)}
      className={`mt-1 flex cursor-pointer items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
        running ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-strong bg-page text-ink'
      }`}
    >
      <Timer size={14} aria-hidden="true" />
      {running ? (left > 0 ? `${label} · tap to stop` : 'Done · tap to reset') : `Start ${minutes} min timer`}
    </button>
  );
}

function Steps({ steps }: { steps: Step[] }) {
  const groups: Array<{ name: string; steps: Array<Step & { n: number }> }> = [
    { name: 'Preparation', steps: [] },
    { name: 'Cooking', steps: [] },
  ];
  let n = 0;
  for (const s of steps.filter((x) => x.section === 'preparation')) groups[0]!.steps.push({ ...s, n: ++n });
  for (const s of steps.filter((x) => x.section === 'cooking')) groups[1]!.steps.push({ ...s, n: ++n });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-7">
      {groups.map((g) =>
        g.steps.length ? (
          <section key={g.name} className="flex flex-col gap-3.5">
            <h2 className="text-lg font-bold">{g.name}</h2>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {g.steps.map((s) => (
                <li key={s.n} className="flex gap-4 rounded-2xl border border-line bg-surface px-[18px] py-4">
                  <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-page">{s.n}</span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    {s.title && <div className="font-semibold">{s.title}</div>}
                    <div className="text-ink-2">
                      <Markdown>{s.text}</Markdown>
                    </div>
                    {s.timerMins ? <StepTimer minutes={s.timerMins} /> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null,
      )}
    </div>
  );
}

export function RecipePage() {
  const id = Number(useParams().id);
  const { me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const recipe = useRecipe(id);

  const trash = useMutation({
    mutationFn: () => api.del(`/recipes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes'] });
      qc.removeQueries({ queryKey: recipeKey(id) });
      navigate('/');
      toast(`Moved “${recipe.data?.title}” to the Trash`, {
        action: {
          label: 'Undo',
          onClick: () =>
            api.post(`/trash/${id}/restore`).then(() => {
              qc.invalidateQueries({ queryKey: ['recipes'] });
              navigate(`/recipes/${id}`);
            }),
        },
      });
    },
  });
  const reviewed = useMutation({
    mutationFn: () => api.post(`/recipes/${id}/reviewed`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recipeKey(id) });
      qc.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  if (recipe.isPending) return null;
  if (recipe.isError) {
    return (
      <div className="flex max-w-lg flex-col gap-3">
        <Alert>{formError(recipe.error)}</Alert>
        <Link to="/">Back to all recipes</Link>
      </div>
    );
  }
  const r = recipe.data;

  return (
    <article className="flex max-w-[1060px] flex-col gap-7">
      <Link to="/" className="flex items-center gap-1.5 self-start py-1.5 font-semibold no-underline">
        <ChevronLeft size={16} aria-hidden="true" /> All recipes
      </Link>

      <section className="flex flex-wrap items-stretch gap-8">
        <div className="min-h-[240px] flex-[1_1_380px] overflow-hidden rounded-[20px]">
          {r.coverPhoto ? (
            <a href={photoUrl(r.coverPhoto)} target="_blank" rel="noopener noreferrer">
              <RecipePhoto id={r.id} photo={r.coverPhoto} size="full" className="h-full max-h-[420px] w-full" />
            </a>
          ) : (
            <RecipePhoto id={r.id} photo={null} className="h-full min-h-[240px] w-full" iconSize={56} />
          )}
        </div>
        <div className="flex flex-[1_1_420px] flex-col gap-4">
          {r.needsReview && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warn-soft px-3.5 py-2.5 text-warn-ink">
              <span>Added by AI · needs review</span>
              {me && (
                <Button size="sm" variant="secondary" busy={reviewed.isPending} onClick={() => reviewed.mutate()}>
                  Looks good
                </Button>
              )}
            </div>
          )}
          <div>
            <h1 className="text-[34px] leading-[42px] font-bold tracking-tight">{r.title}</h1>
            {r.otherName && <p className="mt-0.5 text-xl text-muted">{r.otherName}</p>}
          </div>
          {(r.prepMins || r.cookMins) && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-ink-2">
              {r.prepMins ? (
                <span>
                  <strong className="font-semibold">Prep</strong> {formatMinutes(r.prepMins)}
                </span>
              ) : null}
              {r.cookMins ? (
                <span>
                  <strong className="font-semibold">Cook</strong> {formatMinutes(r.cookMins)}
                </span>
              ) : null}
            </div>
          )}
          {r.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {r.tags.map((t) => (
                <Link key={t.id} to={`/?tags=${t.id}`} className="rounded-full border border-line-strong bg-surface px-3 py-[5px] text-[13px] text-ink-2 no-underline">
                  {t.name}
                </Link>
              ))}
            </div>
          )}
          <RecipeCollections recipe={r} />
          {r.description && (
            <div className="text-ink-2">
              <Markdown>{r.description}</Markdown>
            </div>
          )}
          {me && (
            <div className="mt-1 flex flex-wrap gap-2.5">
              <Link to={`/recipes/${r.id}/edit`} className="flex h-11 items-center rounded-xl border border-line-strong bg-surface px-[18px] font-semibold text-ink no-underline hover:bg-sidebar hover:text-ink">
                Edit
              </Link>
              <Button
                variant="danger"
                busy={trash.isPending}
                onClick={() => {
                  if (window.confirm(`Move “${r.title}” to the Trash? It can be restored for 30 days.`)) trash.mutate();
                }}
              >
                Move to Trash
              </Button>
            </div>
          )}
          {trash.isError && <Alert>{formError(trash.error)}</Alert>}
          <p className="text-[13px] text-muted">
            Added by {r.createdBy ?? 'a former member'} on {formatDate(r.createdAt)}
            {r.updatedAt !== r.createdAt && ` · last edited by ${r.updatedBy ?? 'a former member'} on ${formatDate(r.updatedAt)}`}
          </p>
        </div>
      </section>

      <section className="flex flex-col items-start gap-8 lg:flex-row">
        <Ingredients recipe={r} />
        <Steps steps={r.steps} />
      </section>

      <RecipeNotes recipeId={r.id} />
    </article>
  );
}
