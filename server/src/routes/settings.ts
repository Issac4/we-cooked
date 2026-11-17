import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import Holidays from 'date-holidays';
import {
  DEFAULT_SETTINGS,
  HouseholdSettings,
  type CalendarOption,
  type Holiday,
} from '@wecooked/shared';
import type { Db } from '../db/index.js';
import { settings } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { HttpError, parseBody, requireMember } from '../http.js';

const KEY = 'household';

export function getSettings(db: Db): HouseholdSettings {
  const row = db.select().from(settings).where(eq(settings.key, KEY)).get();
  const parsed = HouseholdSettings.partial().safeParse(row?.value ?? {});
  return { ...DEFAULT_SETTINGS, ...(parsed.success ? parsed.data : {}) };
}

export function saveSettings(db: Db, next: HouseholdSettings): void {
  db.insert(settings).values({ key: KEY, value: next }).onConflictDoUpdate({ target: settings.key, set: { value: next } }).run();
}

function makeCalendar(code: string): Holidays | null {
  const [country, region] = code.split('-');
  const option = calendarOptions().find((o) => o.code === country);
  // Unknown codes are refused rather than silently falling back to the whole country.
  if (!option || (region && !option.regions.some((r) => r.code === code))) return null;
  const opts = { languages: ['en'], types: ['public' as const] };
  return region ? new Holidays(country!, region, opts) : new Holidays(country!, opts);
}

const calendarCache = new Map<string, Holidays | null>();
function calendar(code: string): Holidays | null {
  if (!calendarCache.has(code)) calendarCache.set(code, makeCalendar(code));
  return calendarCache.get(code)!;
}

export function isKnownCalendar(code: string): boolean {
  return calendar(code) !== null;
}

/** Public holidays between two dates for the household's calendars, minus hidden ones, plus one-offs. */
export function holidaysBetween(s: HouseholdSettings, from: string, to: string): Holiday[] {
  const out = new Map<string, Holiday>();
  const years = new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))]);
  for (const code of s.holidayCalendars) {
    const hd = calendar(code);
    if (!hd) continue;
    for (const year of years) {
      for (const h of hd.getHolidays(year)) {
        const date = h.date.slice(0, 10);
        if (date < from || date > to || s.hiddenHolidays.includes(date)) continue;
        const existing = out.get(date);
        // Two calendars on the same day (e.g. Christmas): show it once.
        if (existing) {
          if (!existing.calendar.split(', ').includes(code)) existing.calendar += `, ${code}`;
        } else out.set(date, { date, name: h.name, calendar: code });
      }
    }
  }
  for (const extra of s.extraHolidays) {
    if (extra.date >= from && extra.date <= to) out.set(extra.date, { date: extra.date, name: extra.name, calendar: 'Household' });
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}

let optionsCache: CalendarOption[] | null = null;
function calendarOptions(): CalendarOption[] {
  if (optionsCache) return optionsCache;
  const hd = new Holidays();
  const countries = hd.getCountries('en') ?? {};
  optionsCache = Object.entries(countries)
    .map(([code, name]) => ({
      code,
      name,
      regions: Object.entries(hd.getStates(code, 'en') ?? {}).map(([r, rn]) => ({ code: `${code}-${r}`, name: rn })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return optionsCache;
}

export function settingsRoutes() {
  const app = new Hono<AppEnv>();
  app.use(requireMember);

  app.get('/', (c) => c.json(getSettings(c.var.db)));

  app.patch('/', async (c) => {
    const patch = await parseBody(c, HouseholdSettings.partial());
    const next = { ...getSettings(c.var.db), ...patch };
    const unknown = next.holidayCalendars.filter((code) => !isKnownCalendar(code));
    if (unknown.length) throw new HttpError(400, `Unknown holiday calendar: ${unknown.join(', ')}`);
    next.holidayCalendars = [...new Set(next.holidayCalendars)];
    saveSettings(c.var.db, next);
    return c.json(next);
  });

  app.get('/calendars', (c) => c.json(calendarOptions()));

  app.get('/holidays', (c) => {
    const from = c.req.query('from') ?? '';
    const to = c.req.query('to') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new HttpError(400, 'Use from and to as YYYY-MM-DD');
    return c.json(holidaysBetween(getSettings(c.var.db), from, to));
  });

  return app;
}
