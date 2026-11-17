import { z } from 'zod';

/** A calendar day as "YYYY-MM-DD" (no time zone: the household's local day). */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'Not a real date');

export const PlanRow = z.object({ id: z.number(), name: z.string(), position: z.number() });
export type PlanRow = z.infer<typeof PlanRow>;

export const PlanEntry = z.object({
  id: z.number(),
  date: z.string(),
  rowId: z.number(),
  position: z.number(),
  /** Linked recipe, or null for plain text like "Leftovers". */
  recipeId: z.number().nullable(),
  /** Text shown: the recipe's current title, or the typed text. */
  label: z.string(),
});
export type PlanEntry = z.infer<typeof PlanEntry>;

export const PlanEvent = z.object({
  id: z.number(),
  name: z.string(),
  from: z.string(),
  to: z.string(),
  /** Away = no meals at home; those days are greyed out. */
  away: z.boolean(),
});
export type PlanEvent = z.infer<typeof PlanEvent>;

export const Holiday = z.object({ date: z.string(), name: z.string(), calendar: z.string() });
export type Holiday = z.infer<typeof Holiday>;

export const WEEK_STARTS = ['monday', 'sunday'] as const;
export const WeekStart = z.enum(WEEK_STARTS);
export type WeekStart = z.infer<typeof WeekStart>;

export const PlanView = z.object({
  from: z.string(),
  to: z.string(),
  rows: z.array(PlanRow),
  entries: z.array(PlanEntry),
  events: z.array(PlanEvent),
  holidays: z.array(Holiday),
  weekStart: WeekStart,
});
export type PlanView = z.infer<typeof PlanView>;

export const AddEntries = z
  .object({
    dates: z.array(IsoDate).min(1, 'Pick at least one day').max(62),
    rowId: z.number().int().positive(),
    recipeId: z.number().int().positive().nullable().default(null),
    text: z.string().trim().max(120).default(''),
  })
  .refine((v) => v.recipeId !== null || v.text.length > 0, { message: 'Type something or pick a recipe', path: ['text'] });
export type AddEntries = z.infer<typeof AddEntries>;

export const MoveEntry = z.object({
  date: IsoDate,
  rowId: z.number().int().positive(),
  /** Copy instead of move (Alt-drag / long-press). */
  copy: z.boolean().default(false),
});

export const RowInput = z.object({ name: z.string().trim().min(1, 'Name the row').max(40) });
export const RowOrder = z.object({ ids: z.array(z.number().int().positive()).min(1) });

export const EventInput = z
  .object({
    name: z.string().trim().min(1, 'Say what is happening').max(80),
    from: IsoDate,
    to: IsoDate,
    away: z.boolean().default(true),
  })
  .refine((v) => v.from <= v.to, { message: 'The end is before the start', path: ['to'] });
export type EventInput = z.infer<typeof EventInput>;

export const CopyWeek = z.object({ from: IsoDate, to: IsoDate });

export const RecentItem = z.object({ label: z.string(), recipeId: z.number().nullable() });
export type RecentItem = z.infer<typeof RecentItem>;

/** Planned and past days for one recipe (the dot calendar). */
export const RecipeHistory = z.object({
  days: z.array(z.object({ date: z.string(), row: z.string() })),
});
export type RecipeHistory = z.infer<typeof RecipeHistory>;

// ---------- Household settings ----------

/** A holiday calendar: "CA-ON", "US", "HK". */
export const CalendarCode = z.string().regex(/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/);

export const HouseholdSettings = z.object({
  weekStart: WeekStart,
  holidayCalendars: z.array(CalendarCode).max(5),
  hiddenHolidays: z.array(IsoDate).max(200),
  extraHolidays: z.array(z.object({ date: IsoDate, name: z.string().trim().min(1).max(60) })).max(200),
  aiRules: z.string().max(4000),
});
export type HouseholdSettings = z.infer<typeof HouseholdSettings>;

export const DEFAULT_SETTINGS: HouseholdSettings = {
  weekStart: 'monday',
  holidayCalendars: [],
  hiddenHolidays: [],
  extraHolidays: [],
  aiRules: '',
};

export const CalendarOption = z.object({ code: z.string(), name: z.string(), regions: z.array(z.object({ code: z.string(), name: z.string() })) });
export type CalendarOption = z.infer<typeof CalendarOption>;

// ---------- Date helpers (shared so server and browser agree) ----------

const DAY = 86_400_000;
export const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toIso(toTime(iso) + n * DAY);
/** 0 = Sunday … 6 = Saturday */
export const weekday = (iso: string) => new Date(toTime(iso)).getUTCDay();
export function startOfWeek(iso: string, start: WeekStart): string {
  const wd = weekday(iso);
  return addDays(iso, -(start === 'sunday' ? wd : (wd + 6) % 7));
}
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = toTime(from); t <= toTime(to); t += DAY) out.push(toIso(t));
  return out;
}
