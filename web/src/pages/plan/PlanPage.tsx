import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DndContext, MouseSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { toast } from 'sonner';
import { BookOpen, ChevronLeft, ChevronRight, Plane, Plus } from 'lucide-react';
import { addDays, startOfWeek, type PlanEntry, type PlanEvent, type PlanRow, type PlanView } from '@wecooked/shared';
import { formError } from '../../lib/api';
import { dayInfo, planApi, rangeLabel, todayIso, usePlan, usePlanMutation, useSettings, weekDays, type DayInfo } from '../../lib/plan';
import { Menu } from '../../components/Menu';
import { useIsDesktop } from '../../lib/media';
import { RequireMember } from '../../components/RequireMember';
import { Alert, Button } from '../../components/ui';
import { AddEntryDialog, EventDialog, MoveDialog, RepeatDialog, type AddTarget } from './dialogs';

/** "Sat 21 – Sun 22 Nov" */
function eventDates(e: PlanEvent): string {
  const a = dayInfo(e.from);
  const b = dayInfo(e.to);
  if (e.from === e.to) return `${a.dow} ${a.day} ${a.month}`;
  return a.month === b.month ? `${a.dow} ${a.day} – ${b.dow} ${b.day} ${b.month}` : `${a.dow} ${a.day} ${a.month} – ${b.dow} ${b.day} ${b.month}`;
}

const AWAY_BG = 'bg-[repeating-linear-gradient(135deg,var(--wc-sidebar)_0_8px,var(--wc-line)_8px_16px)]';

interface Actions {
  add: (t: AddTarget) => void;
  repeat: (e: PlanEntry) => void;
  move: (e: PlanEntry) => void;
  remove: (e: PlanEntry) => void;
}

function EntryChip({ entry, actions, draggable = false }: { entry: PlanEntry; actions: Actions; draggable?: boolean }) {
  const drag = useDraggable({ id: `entry:${entry.id}`, data: { entry }, disabled: !draggable });
  const style = drag.transform ? { transform: `translate(${drag.transform.x}px, ${drag.transform.y}px)`, zIndex: 40, position: 'relative' as const } : undefined;
  const look = entry.recipeId ? 'bg-accent-soft text-accent-ink' : 'bg-sidebar text-ink-2';
  return (
    <div ref={drag.setNodeRef} style={style} className={`flex items-start gap-0.5 rounded-lg ${drag.isDragging ? 'shadow-lg' : ''}`} {...drag.attributes} {...drag.listeners} role="group" aria-label={entry.label}>
      {entry.recipeId ? (
        <Link to={`/recipes/${entry.recipeId}`} draggable={false} className={`flex min-w-0 flex-1 gap-1.5 rounded-lg px-2 py-1.5 text-[13px] leading-[17px] font-medium no-underline hover:text-accent-ink ${look}`}>
          <BookOpen size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{entry.label}</span>
        </Link>
      ) : (
        <span className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[13px] leading-[17px] break-words ${look}`}>{entry.label}</span>
      )}
      <Menu
        label={`Options for ${entry.label}`}
        align="right"
        items={[
          { label: 'Repeat on other days…', onSelect: () => actions.repeat(entry) },
          { label: 'Move or copy…', onSelect: () => actions.move(entry) },
          { label: 'Remove', danger: true, onSelect: () => actions.remove(entry) },
        ]}
      />
    </div>
  );
}

function Cell({ day, row, entries, away, today, red, actions }: { day: DayInfo; row: PlanRow; entries: PlanEntry[]; away: boolean; today: boolean; red: boolean; actions: Actions }) {
  const drop = useDroppable({ id: `cell:${day.iso}:${row.id}`, data: { date: day.iso, rowId: row.id } });
  const bg = away ? AWAY_BG : drop.isOver ? 'bg-accent-soft/60' : today ? 'bg-accent-soft/25' : red ? 'bg-holiday/[0.03]' : '';
  return (
    <div ref={drop.setNodeRef} className={`flex min-h-[104px] flex-col gap-1.5 border-r border-line p-2 last:border-r-0 ${bg}`}>
      {entries.map((e) => (
        <EntryChip key={e.id} entry={e} actions={actions} draggable />
      ))}
      {away ? (
        <div className="mt-auto flex flex-col items-start">
          <span className="text-xs font-semibold text-muted">Away</span>
          <button type="button" onClick={() => actions.add({ date: day.iso, row })} className="cursor-pointer py-0.5 text-xs text-muted underline">
            Add anyway
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Add to ${row.name} on ${day.long} ${day.day} ${day.month}`}
          onClick={() => actions.add({ date: day.iso, row })}
          className="mt-auto flex h-7 cursor-pointer items-center justify-center rounded-lg border border-dashed border-line-strong text-muted hover:border-muted hover:text-ink"
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function RowLabel({ row, index, rows }: { row: PlanRow; index: number; rows: PlanRow[] }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(row.name);
  const rename = usePlanMutation(planApi.renameRow);
  const order = usePlanMutation(planApi.orderRows);
  const remove = usePlanMutation(planApi.removeRow);
  const swap = (dir: -1 | 1) => {
    const ids = rows.map((r) => r.id);
    [ids[index], ids[index + dir]] = [ids[index + dir]!, ids[index]!];
    order.mutate(ids);
  };
  return (
    <div className="flex flex-col gap-1 border-r border-line bg-page px-2 py-2.5">
      {renaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) rename.mutate({ id: row.id, name: name.trim() }, { onSuccess: () => setRenaming(false) });
          }}
        >
          <input autoFocus aria-label="Row name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setRenaming(false)} onKeyDown={(e) => e.key === 'Escape' && setRenaming(false)} className="h-8 w-full rounded-lg border border-line-strong bg-surface px-2 text-[13px]" />
        </form>
      ) : (
        <div className="flex items-start justify-between gap-1">
          <span className="pt-1 pl-1 leading-[18px] font-semibold">{row.name}</span>
          <Menu
            label={`Options for row ${row.name}`}
            items={[
              { label: 'Rename', onSelect: () => (setName(row.name), setRenaming(true)) },
              { label: 'Move up', disabled: index === 0, onSelect: () => swap(-1) },
              { label: 'Move down', disabled: index === rows.length - 1, onSelect: () => swap(1) },
              {
                label: 'Delete row',
                danger: true,
                disabled: rows.length <= 1,
                onSelect: () => window.confirm(`Delete the “${row.name}” row and everything planned in it?`) && remove.mutate(row.id),
              },
            ]}
          />
        </div>
      )}
      {(order.error || remove.error || rename.error) && <span className="text-xs text-danger">{formError(order.error ?? remove.error ?? rename.error)}</span>}
    </div>
  );
}

function AddRow() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const add = usePlanMutation(planApi.addRow);
  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="text-accent" onClick={() => setOpen(true)}>
        <Plus size={14} aria-hidden="true" /> Add row
      </Button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) add.mutate(name.trim(), { onSuccess: () => (setName(''), setOpen(false)) });
      }}
    >
      <label htmlFor="new-row" className="font-semibold">
        Row name
      </label>
      <input id="new-row" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dessert, Kids’ snack" className="h-9 w-60 rounded-[10px] border border-line-strong bg-surface px-3" />
      <Button type="submit" size="sm" busy={add.isPending} disabled={!name.trim()}>
        Add
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}

function EventBars({ events, days, onEdit, onAdd }: { events: PlanEvent[]; days: DayInfo[]; onEdit: (e: PlanEvent) => void; onAdd: () => void }) {
  const first = days[0]!.iso;
  const last = days[6]!.iso;
  return (
    <div className="grid grid-cols-[116px_repeat(7,minmax(126px,1fr))] gap-y-1 border-b border-line py-1.5">
      <div className="row-span-full flex items-center px-4 text-xs font-semibold tracking-[0.06em] text-muted uppercase" style={{ gridRow: `1 / span ${Math.max(1, events.length)}` }}>
        Events
      </div>
      {events.length === 0 && (
        <button type="button" onClick={onAdd} className="col-[2/9] mx-1.5 h-[34px] cursor-pointer rounded-lg border border-dashed border-line-strong px-3 text-left text-muted hover:text-ink">
          Nothing this week. Add a trip, a visit or a party so you plan around it.
        </button>
      )}
      {events.map((e, i) => {
        const a = days.findIndex((d) => d.iso >= (e.from < first ? first : e.from));
        const b = days.findIndex((d) => d.iso === (e.to > last ? last : e.to));
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onEdit(e)}
            style={{ gridColumn: `${a + 2} / ${b + 3}`, gridRow: i + 1 }}
            className={`mx-1.5 flex min-h-[34px] cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-[13px] ${e.away ? `${AWAY_BG} border border-dashed border-muted text-ink-2` : 'bg-[#ECE7F6] text-[#46376F] dark:bg-[#2c2640] dark:text-[#d7cdf5]'}`}
          >
            {e.away && <Plane size={14} className="shrink-0" aria-hidden="true" />}
            <span className="truncate">
              <strong className="font-semibold">{e.name}</strong>
              {e.away ? ' · away, no meals at home' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function WeekGrid({ view, days, actions, onEditEvent, onAddEvent }: { view: PlanView; days: DayInfo[]; actions: Actions; onEditEvent: (e: PlanEvent) => void; onAddEvent: () => void }) {
  const today = todayIso();
  const holidays = new Map(view.holidays.map((h) => [h.date, h.name]));
  const away = (iso: string) => view.events.some((e) => e.away && e.from <= iso && iso <= e.to);
  const altDown = useRef(false);
  const move = usePlanMutation(planApi.moveEntry);
  useEffect(() => {
    const set = (e: KeyboardEvent) => (altDown.current = e.altKey);
    window.addEventListener('keydown', set);
    window.addEventListener('keyup', set);
    return () => {
      window.removeEventListener('keydown', set);
      window.removeEventListener('keyup', set);
    };
  }, []);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const entry = e.active.data.current?.entry as PlanEntry | undefined;
    const target = e.over?.data.current as { date: string; rowId: number } | undefined;
    if (!entry || !target) return;
    const copy = altDown.current || (e.activatorEvent as MouseEvent).altKey;
    if (!copy && target.date === entry.date && target.rowId === entry.rowId) return;
    move.mutate({ id: entry.id, date: target.date, rowId: target.rowId, copy });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <div className="min-w-[1010px]">
          <div className="grid grid-cols-[116px_repeat(7,minmax(126px,1fr))] border-b border-line bg-page">
            <div className="flex items-end px-4 py-2.5 text-xs text-muted">{view.holidays.length ? 'Holidays in red' : ''}</div>
            {days.map((d) => {
              const isToday = d.iso === today;
              const holiday = holidays.get(d.iso);
              const red = d.weekend || !!holiday;
              return (
                <div key={d.iso} className={`flex flex-col items-center gap-px px-1.5 pt-2 pb-1.5 ${isToday ? 'bg-accent-soft' : ''} ${red ? 'text-holiday' : isToday ? 'text-accent-ink' : 'text-ink-2'}`}>
                  <span className="text-xs font-semibold tracking-[0.06em] uppercase">{isToday ? 'Today' : d.dow}</span>
                  <span className="text-lg font-bold">{d.day}</span>
                  <span className="min-h-[14px] text-center text-[11px] leading-[14px] font-semibold">{holiday ?? ''}</span>
                </div>
              );
            })}
          </div>
          <EventBars events={view.events} days={days} onEdit={onEditEvent} onAdd={onAddEvent} />
          {view.rows.map((row, ri) => (
            <div key={row.id} className="grid grid-cols-[116px_repeat(7,minmax(126px,1fr))] border-b border-line">
              <RowLabel row={row} index={ri} rows={view.rows} />
              {days.map((d) => (
                <Cell
                  key={d.iso}
                  day={d}
                  row={row}
                  entries={view.entries.filter((e) => e.date === d.iso && e.rowId === row.id)}
                  away={away(d.iso)}
                  today={d.iso === today}
                  red={d.weekend || holidays.has(d.iso)}
                  actions={actions}
                />
              ))}
            </div>
          ))}
          <div className="px-3 py-2.5">
            <AddRow />
          </div>
        </div>
      </div>
      {move.isError && <Alert>{formError(move.error)}</Alert>}
    </DndContext>
  );
}

/** Phone: a week strip, then one card per day. */
function DayList({ view, days, actions, onEditEvent }: { view: PlanView; days: DayInfo[]; actions: Actions; onEditEvent: (e: PlanEvent) => void }) {
  const today = todayIso();
  const holidays = new Map(view.holidays.map((h) => [h.date, h.name]));
  const awayEvent = (iso: string) => view.events.find((e) => e.away && e.from <= iso && iso <= e.to);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const red = d.weekend || holidays.has(d.iso);
          const look = d.iso === today ? 'bg-accent text-white' : awayEvent(d.iso) ? `${AWAY_BG} border border-dashed border-muted` : 'border border-line bg-surface';
          return (
            <a key={d.iso} href={`#day-${d.iso}`} className={`flex flex-col items-center rounded-[10px] py-1.5 leading-4 no-underline ${look} ${red && d.iso !== today ? 'text-holiday' : d.iso === today ? '' : 'text-ink-2'}`}>
              <span className="text-[11px]">{d.dow}</span>
              <span className="font-bold">{d.day}</span>
            </a>
          );
        })}
      </div>
      {view.events.map((e) => (
        <button key={e.id} type="button" onClick={() => onEditEvent(e)} className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] ${e.away ? `${AWAY_BG} border border-dashed border-muted text-ink-2` : 'bg-[#ECE7F6] text-[#46376F]'}`}>
          {e.away && <Plane size={15} aria-hidden="true" />}
          <span>
            <strong className="font-semibold">{e.name}</strong> · {eventDates(e)}
            {e.away ? ' · away' : ''}
          </span>
        </button>
      ))}
      {days.map((d) => {
        const away = awayEvent(d.iso);
        const holiday = holidays.get(d.iso);
        return (
          <section key={d.iso} id={`day-${d.iso}`} className={`flex scroll-mt-4 flex-col gap-2 rounded-2xl border border-line p-3.5 ${away ? AWAY_BG : 'bg-surface'}`}>
            <h2 className={`text-base font-bold ${d.weekend || holiday ? 'text-holiday' : ''}`}>
              {d.iso === today ? 'Today · ' : ''}
              {d.dow} {d.day} {d.month}
              {holiday && <span className="ml-2 text-xs font-semibold">{holiday}</span>}
              {away && <span className="ml-2 text-xs font-semibold text-muted">Away · {away.name}</span>}
            </h2>
            {view.rows.map((row) => (
              <div key={row.id} className="flex items-start gap-2.5 border-t border-line pt-2">
                <span className="w-[76px] shrink-0 pt-1.5 text-xs font-semibold text-muted">{row.name}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {view.entries
                    .filter((e) => e.date === d.iso && e.rowId === row.id)
                    .map((e) => (
                      <EntryChip key={e.id} entry={e} actions={actions} />
                    ))}
                  <button
                    type="button"
                    aria-label={`Add to ${row.name}, ${d.long} ${d.day} ${d.month}`}
                    onClick={() => actions.add({ date: d.iso, row })}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-dashed border-line-strong text-muted"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </section>
        );
      })}
      <AddRow />
    </div>
  );
}

function Planner() {
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const weekStart = settings.data?.weekStart ?? 'monday';
  const start = settings.data ? startOfWeek(params.get('week') ?? todayIso(), weekStart) : null;
  const plan = usePlan(start);
  const days = useMemo(() => (start ? weekDays(start) : []), [start]);
  const desktop = useIsDesktop();

  const [adding, setAdding] = useState<AddTarget | null>(null);
  const [repeating, setRepeating] = useState<PlanEntry | null>(null);
  const [moving, setMoving] = useState<PlanEntry | null>(null);
  const [eventDialog, setEventDialog] = useState<{ open: boolean; event?: PlanEvent }>({ open: false });
  const remove = usePlanMutation(planApi.removeEntry);
  const copyWeek = usePlanMutation(planApi.copyWeek);

  const actions: Actions = {
    add: setAdding,
    repeat: setRepeating,
    move: setMoving,
    remove: (e) => remove.mutate(e.id),
  };
  const goWeek = (iso: string | null) => {
    const next = new URLSearchParams(params);
    if (iso) next.set('week', iso);
    else next.delete('week');
    setParams(next);
  };

  if (!start || !plan.data) {
    return plan.isError || settings.isError ? <Alert>{formError(plan.error ?? settings.error)}</Alert> : null;
  }
  const view = plan.data;
  const awayDates = new Set(days.filter((d) => view.events.some((e) => e.away && e.from <= d.iso && d.iso <= e.to)).map((d) => d.iso));
  const redDates = new Set(view.holidays.map((h) => h.date));
  const isThisWeek = start === startOfWeek(todayIso(), weekStart);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] leading-9 font-bold tracking-tight">Meal plan</h1>
          <div className="flex items-center gap-1 rounded-xl border border-line-strong bg-surface p-[3px]">
            <button type="button" aria-label="Previous week" onClick={() => goWeek(addDays(start, -7))} className="flex size-9 cursor-pointer items-center justify-center rounded-[9px] hover:bg-sidebar">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[150px] px-2 text-center font-semibold" aria-live="polite">
              {rangeLabel(start)}
            </span>
            <button type="button" aria-label="Next week" onClick={() => goWeek(addDays(start, 7))} className="flex size-9 cursor-pointer items-center justify-center rounded-[9px] hover:bg-sidebar">
              <ChevronRight size={16} />
            </button>
          </div>
          {!isThisWeek && (
            <Button variant="secondary" onClick={() => goWeek(null)}>
              This week
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="secondary" onClick={() => setEventDialog({ open: true })}>
            Add event
          </Button>
          {view.entries.length === 0 && (
            <Button
              variant="secondary"
              busy={copyWeek.isPending}
              onClick={() =>
                copyWeek.mutate(
                  { from: addDays(start, -7), to: start },
                  { onSuccess: (r) => toast.success(`Copied ${(r as { copied: number }).copied} meals from last week`), onError: (err) => toast.error(formError(err) ?? 'Could not copy') },
                )
              }
            >
              Copy last week
            </Button>
          )}
        </div>
      </header>

      {desktop ? (
        <WeekGrid view={view} days={days} actions={actions} onEditEvent={(e) => setEventDialog({ open: true, event: e })} onAddEvent={() => setEventDialog({ open: true })} />
      ) : (
        <DayList view={view} days={days} actions={actions} onEditEvent={(e) => setEventDialog({ open: true, event: e })} />
      )}
      {remove.isError && <Alert>{formError(remove.error)}</Alert>}

      <p className="hidden text-[13px] text-muted md:block">
        Green = linked recipe, beige = plain text. Drag an entry to move it; hold Alt while dragging to copy. Use an entry’s ⋯ menu to repeat it on other days.
      </p>

      <AddEntryDialog target={adding} onClose={() => setAdding(null)} week={days} awayDates={awayDates} redDates={redDates} />
      <RepeatDialog entry={repeating} onClose={() => setRepeating(null)} weekStart={weekStart} rows={view.rows} />
      <MoveDialog entry={moving} onClose={() => setMoving(null)} rows={view.rows} />
      <EventDialog open={eventDialog.open} event={eventDialog.event} onClose={() => setEventDialog({ open: false })} defaultFrom={isThisWeek ? todayIso() : start} />
    </div>
  );
}

export function PlanPage() {
  return (
    <RequireMember what="The meal plan">
      <Planner />
    </RequireMember>
  );
}
