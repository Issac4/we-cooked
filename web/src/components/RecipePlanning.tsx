import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, RecipeHistory, startOfWeek, toTime, type PlanRow } from '@wecooked/shared';
import { api, formError } from '../lib/api';
import { dayInfo, planApi, rangeLabel, todayIso, usePlan, usePlanMutation, useSettings, weekDays } from '../lib/plan';
import { Dialog } from './Dialog';
import { Alert, Button } from './ui';

/** "Add to plan" on a recipe: pick a week, any days, and a row. */
export function AddToPlanButton({ recipeId, title }: { recipeId: number; title: string }) {
  const [open, setOpen] = useState(false);
  const settings = useSettings();
  const weekStart = settings.data?.weekStart ?? 'monday';
  const [start, setStart] = useState<string | null>(null);
  const currentStart = start ?? startOfWeek(todayIso(), weekStart);
  const plan = usePlan(open && settings.data ? currentStart : null);
  const [days, setDays] = useState<Set<string>>(new Set());
  const [rowId, setRowId] = useState<number | null>(null);
  const add = usePlanMutation(planApi.addEntries);
  const [done, setDone] = useState<string | null>(null);

  const rows: PlanRow[] = plan.data?.rows ?? [];
  const chosenRow = rowId ?? rows.find((r) => r.name === 'Dinner')?.id ?? rows[0]?.id ?? null;
  const holidays = new Set(plan.data?.holidays.map((h) => h.date) ?? []);
  const away = (iso: string) => plan.data?.events.some((e) => e.away && e.from <= iso && iso <= e.to) ?? false;
  const week = weekDays(currentStart);

  const reset = () => {
    setDays(new Set());
    setStart(null);
    add.reset();
  };

  return (
    <>
      <Button
        onClick={() => {
          reset();
          setDone(null);
          setOpen(true);
        }}
      >
        <CalendarDays size={16} aria-hidden="true" /> Add to plan
      </Button>
      {done && (
        <p role="status" className="w-full rounded-xl bg-accent-soft px-3.5 py-2.5 font-medium text-accent-ink">
          {done} <Link to="/plan" className="font-semibold">Open meal plan</Link>
        </p>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={`Add “${title}” to the plan`} wide>
        <div className="flex items-center justify-between">
          <button type="button" aria-label="Previous week" onClick={() => setStart(addDays(currentStart, -7))} className="flex size-9 cursor-pointer items-center justify-center rounded-lg hover:bg-sidebar">
            <ChevronLeft size={16} />
          </button>
          <span className="font-semibold">{rangeLabel(currentStart)}</span>
          <button type="button" aria-label="Next week" onClick={() => setStart(addDays(currentStart, 7))} className="flex size-9 cursor-pointer items-center justify-center rounded-lg hover:bg-sidebar">
            <ChevronRight size={16} />
          </button>
        </div>
        <div role="group" aria-label="Days" className="flex flex-wrap gap-1.5">
          {week.map((d) => {
            const on = days.has(d.iso);
            const red = d.weekend || holidays.has(d.iso);
            return (
              <button
                key={d.iso}
                type="button"
                aria-pressed={on}
                aria-label={`${d.long} ${d.day} ${d.month}${away(d.iso) ? ', away' : ''}`}
                onClick={() =>
                  setDays((s) => {
                    const next = new Set(s);
                    if (next.has(d.iso)) next.delete(d.iso);
                    else next.add(d.iso);
                    return next;
                  })
                }
                className={`flex size-[54px] cursor-pointer flex-col items-center justify-center rounded-xl border leading-4 ${
                  on ? 'border-accent bg-accent text-on-accent' : `border-line-strong bg-surface ${red ? 'text-holiday' : 'text-ink-2'} ${away(d.iso) ? 'opacity-50' : ''}`
                }`}
              >
                <span className="text-xs">{d.dow}</span>
                <span className="font-semibold">{d.day}</span>
              </button>
            );
          })}
        </div>
        <div role="group" aria-label="Row" className="flex flex-wrap gap-1.5">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={chosenRow === r.id}
              onClick={() => setRowId(r.id)}
              className={`cursor-pointer rounded-full border px-[13px] py-[7px] text-[13px] font-medium ${chosenRow === r.id ? 'border-ink bg-ink text-page' : 'border-line-strong bg-surface text-ink-2'}`}
            >
              {r.name}
            </button>
          ))}
        </div>
        {formError(add.error) && <Alert>{formError(add.error)}</Alert>}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-muted">Pick several days at once, in a row or not.</span>
          <Button
            disabled={!days.size || !chosenRow}
            busy={add.isPending}
            onClick={() => {
              const sorted = [...days].sort();
              add.mutate(
                { dates: sorted, rowId: chosenRow!, recipeId },
                {
                  onSuccess: () => {
                    const rowName = rows.find((r) => r.id === chosenRow)?.name ?? '';
                    setDone(`Added to ${rowName} on ${sorted.map((d) => `${dayInfo(d).dow} ${dayInfo(d).day}`).join(', ')}.`);
                    setOpen(false);
                  },
                },
              );
            }}
          >
            {days.size ? `Add to ${days.size} ${days.size === 1 ? 'day' : 'days'}` : 'Pick a day'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

/** GitHub-style dots: past days this recipe was on the plan (filled) and upcoming ones (outlined). */
export function CookingHistory({ recipeId }: { recipeId: number }) {
  const today = todayIso();
  const history = useQuery({
    queryKey: ['history', recipeId, today],
    queryFn: () => api.get(`/plan/history/${recipeId}?today=${today}`, RecipeHistory),
  });

  const { weeks, cooked, last, next } = useMemo(() => {
    const byDate = new Map<string, string[]>();
    for (const d of history.data?.days ?? []) byDate.set(d.date, [...(byDate.get(d.date) ?? []), d.row]);
    const end = addDays(startOfWeek(today, 'sunday'), 6);
    const begin = addDays(end, -(53 * 7 - 1));
    let lastMonth = '';
    const weeks = Array.from({ length: 53 }, (_, w) => {
      const days = Array.from({ length: 7 }, (_, d) => {
        const iso = addDays(begin, w * 7 + d);
        const info = dayInfo(iso);
        const rows = byDate.get(iso);
        const future = iso > today;
        return { iso, future, rows, tip: `${info.day} ${info.month} ${iso.slice(0, 4)}${rows ? ` · ${future ? 'planned for ' : ''}${rows.join(', ')}` : ''}` };
      });
      const firstOfMonth = days.find((x) => x.iso.slice(8) === '01');
      const label = firstOfMonth && firstOfMonth.iso.slice(0, 7) !== lastMonth ? dayInfo(firstOfMonth.iso).month : '';
      if (label) lastMonth = firstOfMonth!.iso.slice(0, 7);
      return { label, days };
    });
    const past = [...byDate.keys()].filter((d) => d <= today && toTime(d) >= toTime(today) - 365 * 86_400_000).sort();
    const upcoming = [...byDate.keys()].filter((d) => d > today).sort();
    return { weeks, cooked: past.length, last: past.at(-1), next: upcoming[0] };
  }, [history.data, today]);

  if (history.isPending || history.isError) return null;
  const fmt = (iso: string) => `${dayInfo(iso).dow} ${dayInfo(iso).day} ${dayInfo(iso).month}`;

  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface px-5 py-4" aria-labelledby="history-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="history-title" className="text-base font-bold">
          Cooking history
        </h2>
        <span className="text-[13px] text-muted">
          {cooked ? `On the plan ${cooked} ${cooked === 1 ? 'time' : 'times'} in the past year · last ${fmt(last!)}` : 'Not on the plan in the past year'}
          {next ? ` · next ${fmt(next)}` : ''}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex w-max flex-col gap-1">
          <div className="flex h-3.5 gap-[3px] pl-[33px] text-[11px] leading-[14px] text-muted" aria-hidden="true">
            {weeks.map((w, i) => (
              <span key={i} className="w-[11px] shrink-0 overflow-visible whitespace-nowrap">
                {w.label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            <div className="grid w-[30px] grid-rows-[repeat(7,11px)] gap-[3px] text-[10px] leading-[11px] text-muted" aria-hidden="true">
              <span />
              <span>Mon</span>
              <span />
              <span>Wed</span>
              <span />
              <span>Fri</span>
              <span />
            </div>
            {weeks.map((w, i) => (
              <div key={i} className="grid grid-rows-[repeat(7,11px)] gap-[3px]">
                {w.days.map((d) => (
                  <span
                    key={d.iso}
                    title={d.tip}
                    className={`size-[11px] rounded-[2px] ${
                      d.rows ? (d.future ? 'border-[1.5px] border-accent bg-surface' : 'bg-accent') : d.future ? 'bg-transparent' : 'bg-line'
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-[11px] rounded-[2px] bg-accent" /> On the meal plan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-[11px] rounded-[2px] border-[1.5px] border-accent" /> Planned
        </span>
        <span>Hover a square for the date. Built from the meal plan, so there is nothing extra to log.</span>
      </div>
    </section>
  );
}
