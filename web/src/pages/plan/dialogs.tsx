import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, startOfWeek, type PlanEntry, type PlanEvent, type PlanRow, type WeekStart } from '@wecooked/shared';
import { fieldError, formError } from '../../lib/api';
import { dayInfo, planApi, usePlanMutation, useRecent, type DayInfo } from '../../lib/plan';
import { useAllRecipes } from '../../lib/recipes';
import { Dialog } from '../../components/Dialog';
import { Alert, Button, TextField } from '../../components/ui';

/** Day button used in "Also add to" and the repeat calendar. */
function DayChip({ day, on, home, note, onClick, red }: { day: DayInfo; on: boolean; home?: boolean; note?: string; red?: boolean; onClick: () => void }) {
  const look = home
    ? 'border-accent-soft bg-accent-soft text-accent-ink cursor-default'
    : on
      ? 'border-accent bg-accent text-white'
      : `border-line-strong bg-surface ${red ? 'text-holiday' : 'text-ink-2'}`;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={home}
      onClick={onClick}
      className={`flex size-[58px] cursor-pointer flex-col items-center justify-center rounded-xl border leading-[15px] ${look}`}
    >
      <span className="text-[11px]">{day.dow}</span>
      <span className="font-bold">{day.day}</span>
      <span className="text-[10px] leading-3">{note ?? ''}</span>
    </button>
  );
}

export interface AddTarget {
  date: string;
  row: PlanRow;
}

/** Click a cell → type or pick → done. Tick more days to add the same thing to all of them. */
export function AddEntryDialog({ target, onClose, week, awayDates, redDates }: { target: AddTarget | null; onClose: () => void; week: DayInfo[]; awayDates: Set<string>; redDates: Set<string> }) {
  const open = target !== null;
  const recipes = useAllRecipes(open);
  const recent = useRecent(open);
  const add = usePlanMutation(planApi.addEntries);
  const [query, setQuery] = useState('');
  const [also, setAlso] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) {
      setQuery('');
      setAlso(new Set());
      add.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.date, target?.row.id]);

  const q = query.trim();
  const suggestions = useMemo(() => {
    if (!q) return (recent.data ?? []).map((r) => ({ label: r.label, recipeId: r.recipeId, kind: r.recipeId ? 'Recipe' : 'Text' }));
    const lower = q.toLowerCase();
    const matches = (recipes.data?.recipes ?? [])
      .filter((r) => `${r.title} ${r.otherName}`.toLowerCase().includes(lower))
      .slice(0, 6)
      .map((r) => ({ label: r.title, recipeId: r.id as number | null, kind: 'Recipe' }));
    const exact = matches.some((m) => m.label.toLowerCase() === lower);
    return exact ? matches : [...matches, { label: q, recipeId: null, kind: 'No recipe link' }];
  }, [q, recent.data, recipes.data]);

  if (!target) return null;
  const pick = (s: { label: string; recipeId: number | null }) => {
    const dates = [target.date, ...[...also].filter((d) => d !== target.date)];
    add.mutate({ dates, rowId: target.row.id, recipeId: s.recipeId, text: s.recipeId ? '' : s.label }, { onSuccess: onClose });
  };
  const home = dayInfo(target.date);

  return (
    <Dialog open={open} onClose={onClose} title={`Add to ${target.row.name} · ${home.dow} ${home.day} ${home.month}${also.size ? ` + ${also.size} more` : ''}`} wide>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="plan-dish" className="text-[13px] font-semibold text-ink-2">
          Type a dish, or search your recipes
        </label>
        <input
          id="plan-dish"
          autoFocus
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && suggestions[0]) {
              e.preventDefault();
              pick(suggestions[0]);
            }
          }}
          placeholder="e.g. soy chicken, or “Leftovers”"
          className="h-[46px] rounded-xl border-2 border-accent bg-surface px-3.5"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink-2">Also add to</span>
        <div role="group" aria-label="Also add to these days" className="flex flex-wrap gap-1.5">
          {week.map((d) => (
            <DayChip
              key={d.iso}
              day={d}
              home={d.iso === target.date}
              on={d.iso === target.date || also.has(d.iso)}
              red={d.weekend || redDates.has(d.iso)}
              note={awayDates.has(d.iso) ? 'away' : redDates.has(d.iso) ? 'holiday' : undefined}
              onClick={() =>
                setAlso((s) => {
                  const next = new Set(s);
                  if (next.has(d.iso)) next.delete(d.iso);
                  else next.add(d.iso);
                  return next;
                })
              }
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">{q ? 'Matches' : 'Recently planned'}</span>
        {suggestions.length === 0 && <p className="text-[13px] text-muted">Nothing planned yet. Type a dish above.</p>}
        {suggestions.map((s, i) => (
          <button
            key={`${s.recipeId ?? 't'}-${s.label}`}
            type="button"
            onClick={() => pick(s)}
            disabled={add.isPending}
            className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left ${i === 0 ? 'bg-accent-soft' : 'bg-page hover:bg-sidebar'}`}
          >
            <span className="font-medium">{s.kind === 'No recipe link' ? `Add “${s.label}” as text` : s.label}</span>
            <span className="shrink-0 text-xs text-muted">{s.kind}</span>
          </button>
        ))}
      </div>
      {formError(add.error) && <Alert>{formError(add.error)}</Alert>}
      <p className="text-xs text-muted">Enter picks the highlighted line. For other weeks, use Repeat… in the entry’s menu.</p>
    </Dialog>
  );
}

/** Month calendar to tick more dates for an existing entry, across weeks. */
export function RepeatDialog({ entry, onClose, weekStart, rows }: { entry: PlanEntry | null; onClose: () => void; weekStart: WeekStart; rows: PlanRow[] }) {
  const add = usePlanMutation(planApi.addEntries);
  const [month, setMonth] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (entry) {
      setMonth(`${entry.date.slice(0, 7)}-01`);
      setPicked(new Set());
      add.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);
  if (!entry || !month) return null;

  const first = startOfWeek(month, weekStart);
  const cells = Array.from({ length: 42 }, (_, i) => dayInfo(addDays(first, i)));
  const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(`${month}T00:00:00Z`));
  const shiftMonth = (n: number) => {
    const d = new Date(Date.parse(`${month}T00:00:00Z`));
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 10));
  };
  const rowName = rows.find((r) => r.id === entry.rowId)?.name ?? '';

  return (
    <Dialog open onClose={onClose} title={`Repeat “${entry.label}”`}>
      <p className="-mt-2 text-[13px] text-muted">Tick the days to add it to {rowName}, in any week.</p>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className="flex size-9 cursor-pointer items-center justify-center rounded-lg hover:bg-sidebar">
          <ChevronLeft size={16} />
        </button>
        <span className="font-semibold">{monthName}</span>
        <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className="flex size-9 cursor-pointer items-center justify-center rounded-lg hover:bg-sidebar">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {cells.slice(0, 7).map((d) => (
          <span key={d.dow} className={`text-[11px] font-semibold ${d.weekend ? 'text-holiday' : 'text-muted'}`}>
            {d.dow}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth = d.iso.slice(0, 7) === month.slice(0, 7);
          const isEntry = d.iso === entry.date;
          const on = picked.has(d.iso);
          return (
            <button
              key={d.iso}
              type="button"
              aria-label={`${d.long} ${d.day} ${d.month}`}
              aria-pressed={on || isEntry}
              disabled={isEntry}
              onClick={() =>
                setPicked((s) => {
                  const next = new Set(s);
                  if (next.has(d.iso)) next.delete(d.iso);
                  else next.add(d.iso);
                  return next;
                })
              }
              className={`h-10 cursor-pointer rounded-lg text-sm ${
                isEntry ? 'bg-accent-soft font-semibold text-accent-ink' : on ? 'bg-accent font-semibold text-white' : inMonth ? `hover:bg-sidebar ${d.weekend ? 'text-holiday' : ''}` : 'text-muted/60 hover:bg-sidebar'
              }`}
            >
              {d.day}
            </button>
          );
        })}
      </div>
      {formError(add.error) && <Alert>{formError(add.error)}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!picked.size}
          busy={add.isPending}
          onClick={() =>
            add.mutate({ dates: [...picked].sort(), rowId: entry.rowId, recipeId: entry.recipeId, text: entry.recipeId ? '' : entry.label }, { onSuccess: onClose })
          }
        >
          {picked.size ? `Add to ${picked.size} ${picked.size === 1 ? 'day' : 'days'}` : 'Pick days'}
        </Button>
      </div>
    </Dialog>
  );
}

/** Move or copy one entry to another day and row (the touch-friendly alternative to dragging). */
export function MoveDialog({ entry, onClose, rows }: { entry: PlanEntry | null; onClose: () => void; rows: PlanRow[] }) {
  const move = usePlanMutation(planApi.moveEntry);
  const [date, setDate] = useState('');
  const [rowId, setRowId] = useState(0);
  useEffect(() => {
    if (entry) {
      setDate(entry.date);
      setRowId(entry.rowId);
      move.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);
  if (!entry) return null;
  const go = (copy: boolean) => move.mutate({ id: entry.id, date, rowId, copy }, { onSuccess: onClose });
  return (
    <Dialog open onClose={onClose} title={`Move or copy “${entry.label}”`}>
      <TextField label="Day" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-2">Row</span>
        <select value={rowId} onChange={(e) => setRowId(Number(e.target.value))} className="h-11 rounded-[10px] border border-line-strong bg-surface px-3">
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      {formError(move.error) && <Alert>{formError(move.error)}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={!date} busy={move.isPending && move.variables?.copy} onClick={() => go(true)}>
          Copy
        </Button>
        <Button disabled={!date} busy={move.isPending && !move.variables?.copy} onClick={() => go(false)}>
          Move
        </Button>
      </div>
    </Dialog>
  );
}

/** Create or edit an event (trip, visit, party). */
export function EventDialog({ open, onClose, event, defaultFrom }: { open: boolean; onClose: () => void; event?: PlanEvent; defaultFrom: string }) {
  const save = usePlanMutation(planApi.saveEvent);
  const remove = usePlanMutation(planApi.removeEvent);
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [away, setAway] = useState(true);
  useEffect(() => {
    if (!open) return;
    setName(event?.name ?? '');
    setFrom(event?.from ?? defaultFrom);
    setTo(event?.to ?? defaultFrom);
    setAway(event?.away ?? true);
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  return (
    <Dialog open={open} onClose={onClose} title={event ? 'Edit event' : 'Add event'}>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ id: event?.id, name, from, to, away }, { onSuccess: onClose });
        }}
        noValidate
      >
        <TextField label="What is happening" autoFocus value={name} onChange={(e) => setName(e.target.value)} error={fieldError(save.error, 'name')} placeholder="e.g. Vacation, Grandma visiting" />
        <div className="flex flex-wrap gap-3">
          <TextField label="From" type="date" className="flex-1" value={from} onChange={(e) => setFrom(e.target.value)} error={fieldError(save.error, 'from')} />
          <TextField label="To" type="date" className="flex-1" value={to} onChange={(e) => setTo(e.target.value)} error={fieldError(save.error, 'to')} />
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-page p-3">
          <input type="checkbox" checked={away} onChange={(e) => setAway(e.target.checked)} className="mt-0.5 size-[18px] accent-accent" />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">We are away, no meals at home</span>
            <span className="text-[13px] text-muted">Those days are greyed out so nobody plans them by accident. Untick for things like guests visiting.</span>
          </span>
        </label>
        {formError(save.error) && <Alert>{formError(save.error)}</Alert>}
        <div className="flex flex-wrap justify-end gap-2">
          {event && (
            <Button variant="danger" className="mr-auto" busy={remove.isPending} onClick={() => remove.mutate(event.id, { onSuccess: onClose })}>
              Delete event
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={save.isPending}>
            {event ? 'Save' : 'Add event'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
