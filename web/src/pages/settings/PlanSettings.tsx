import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { z } from 'zod';
import { addDays, CalendarOption, Holiday, HouseholdSettings, type WeekStart } from '@wecooked/shared';
import { api, formError } from '../../lib/api';
import { dayInfo, planKey, settingsKey, todayIso, useSettings } from '../../lib/plan';
import { Alert, Button, Card, TextField } from '../../components/ui';

function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<HouseholdSettings>) => api.patch('/settings', patch, HouseholdSettings),
    onSuccess: (s) => {
      qc.setQueryData(settingsKey, s);
      qc.invalidateQueries({ queryKey: planKey });
      qc.invalidateQueries({ queryKey: ['holidays'] });
    },
  });
}

const fmt = (iso: string) => {
  const d = dayInfo(iso);
  return `${d.dow} ${d.day} ${d.month} ${iso.slice(0, 4)}`;
};

export function PlanSettings() {
  const settings = useSettings();
  const save = useSaveSettings();
  const options = useQuery({ queryKey: ['calendars'], queryFn: () => api.get('/settings/calendars', z.array(CalendarOption)), staleTime: Infinity });
  const today = todayIso();
  const upcoming = useQuery({
    queryKey: ['holidays', today, settings.data?.holidayCalendars, settings.data?.hiddenHolidays, settings.data?.extraHolidays],
    queryFn: () => api.get(`/settings/holidays?from=${today}&to=${addDays(today, 120)}`, z.array(Holiday)),
    enabled: !!settings.data,
  });
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [extraDate, setExtraDate] = useState('');
  const [extraName, setExtraName] = useState('');

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of options.data ?? []) {
      map.set(o.code, o.name);
      for (const r of o.regions) map.set(r.code, `${o.name} · ${r.name}`);
    }
    return map;
  }, [options.data]);

  if (!settings.data) return settings.isError ? <Alert>{formError(settings.error)}</Alert> : null;
  const s = settings.data;
  const regions = options.data?.find((o) => o.code === country)?.regions ?? [];

  return (
    <>
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Meal plan</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold">Week starts on</span>
          <div role="group" aria-label="Week starts on" className="flex rounded-xl bg-sidebar p-[3px]">
            {(['monday', 'sunday'] as WeekStart[]).map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={s.weekStart === w}
                onClick={() => save.mutate({ weekStart: w })}
                className={`h-[38px] cursor-pointer rounded-[9px] px-4 font-semibold capitalize ${s.weekStart === w ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3.5">
        <div>
          <h2 className="text-lg font-bold">Public holidays</h2>
          <p className="text-muted">Shown in red on the meal plan, like weekends. Dates come from a built-in holiday calendar covering 200+ countries and their provinces or states, updated with each app update.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {s.holidayCalendars.map((code) => (
            <span key={code} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pr-1.5 pl-3 font-medium text-accent-ink">
              {names.get(code) ?? code}
              <button
                type="button"
                aria-label={`Remove ${names.get(code) ?? code}`}
                onClick={() => save.mutate({ holidayCalendars: s.holidayCalendars.filter((c) => c !== code) })}
                className="flex size-7 cursor-pointer items-center justify-center rounded-full"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {s.holidayCalendars.length === 0 && <span className="text-muted">No holiday calendar. Only weekends are red.</span>}
        </div>
        <form
          className="flex flex-wrap items-end gap-2.5 rounded-xl bg-page p-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            const code = region || country;
            if (code && !s.holidayCalendars.includes(code)) save.mutate({ holidayCalendars: [...s.holidayCalendars, code] });
          }}
        >
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Country</span>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setRegion('');
              }}
              className="h-11 rounded-[10px] border border-line-strong bg-surface px-2.5"
            >
              <option value="">Choose…</option>
              {options.data?.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Province / state (optional)</span>
            <select value={region} onChange={(e) => setRegion(e.target.value)} disabled={!regions.length} className="h-11 rounded-[10px] border border-line-strong bg-surface px-2.5 disabled:opacity-50">
              <option value="">{regions.length ? 'Whole country' : '—'}</option>
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={!country} busy={save.isPending}>
            Add calendar
          </Button>
        </form>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-[0.06em] text-muted uppercase">Coming up (next 4 months)</span>
          {upcoming.data?.length === 0 && <span className="text-[13px] text-muted">No holidays coming up.</span>}
          {upcoming.data?.map((h) => (
            <div key={h.date} className="flex items-center justify-between gap-3 border-t border-line py-2">
              <span>
                <strong className="font-semibold text-holiday">{fmt(h.date)}</strong> · {h.name} <span className="text-muted">({h.calendar === 'Household' ? 'added by you' : h.calendar.split(', ').map((c) => names.get(c) ?? c).join(', ')})</span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  h.calendar === 'Household'
                    ? save.mutate({ extraHolidays: s.extraHolidays.filter((x) => x.date !== h.date) })
                    : save.mutate({ hiddenHolidays: [...s.hiddenHolidays, h.date] })
                }
              >
                {h.calendar === 'Household' ? 'Remove' : 'Hide'}
              </Button>
            </div>
          ))}
          {s.hiddenHolidays.length > 0 && (
            <p className="text-[13px] text-muted">
              Hidden: {s.hiddenHolidays.map(fmt).join(', ')}.{' '}
              <button type="button" onClick={() => save.mutate({ hiddenHolidays: [] })} className="cursor-pointer font-semibold text-accent">
                Show them again
              </button>
            </p>
          )}
        </div>

        <form
          className="flex flex-wrap items-end gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!extraDate || !extraName.trim()) return;
            save.mutate(
              { extraHolidays: [...s.extraHolidays.filter((x) => x.date !== extraDate), { date: extraDate, name: extraName.trim() }] },
              { onSuccess: () => (setExtraDate(''), setExtraName('')) },
            );
          }}
        >
          <TextField label="One-off holiday" type="date" value={extraDate} onChange={(e) => setExtraDate(e.target.value)} className="w-44" />
          <TextField label="Name" value={extraName} onChange={(e) => setExtraName(e.target.value)} placeholder="e.g. Typhoon day off" className="min-w-[200px] flex-1" />
          <Button type="submit" variant="secondary" disabled={!extraDate || !extraName.trim()}>
            Add
          </Button>
        </form>
        {formError(save.error) && <Alert>{formError(save.error)}</Alert>}
      </Card>
    </>
  );
}
