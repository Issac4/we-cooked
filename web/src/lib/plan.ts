import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  addDays,
  HouseholdSettings,
  PlanView,
  RecentItem,
  weekday,
  type AddEntries,
  type EventInput,
} from '@wecooked/shared';
import { api } from './api';

export const planKey = ['plan'] as const;
export const settingsKey = ['settings'] as const;

/** Today in the browser's own time zone, as YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DayInfo {
  iso: string;
  dow: string;
  long: string;
  day: number;
  month: string;
  weekend: boolean;
}

export function dayInfo(iso: string): DayInfo {
  const wd = weekday(iso);
  return {
    iso,
    dow: SHORT[wd]!,
    long: LONG[wd]!,
    day: Number(iso.slice(8, 10)),
    month: MONTHS[Number(iso.slice(5, 7)) - 1]!,
    weekend: wd === 0 || wd === 6,
  };
}

export function weekDays(start: string): DayInfo[] {
  return Array.from({ length: 7 }, (_, i) => dayInfo(addDays(start, i)));
}

/** "16 – 22 Nov 2026" or "30 Nov – 6 Dec 2026". */
export function rangeLabel(start: string): string {
  const a = dayInfo(start);
  const end = addDays(start, 6);
  const b = dayInfo(end);
  const year = end.slice(0, 4);
  return a.month === b.month ? `${a.day} – ${b.day} ${b.month} ${year}` : `${a.day} ${a.month} – ${b.day} ${b.month} ${year}`;
}

export function useSettings(enabled = true) {
  return useQuery({ queryKey: settingsKey, queryFn: () => api.get('/settings', HouseholdSettings), enabled, staleTime: 5 * 60_000 });
}

/** One week of the plan. Refreshes every 15 s and on focus so two people see each other's changes. */
export function usePlan(start: string | null) {
  return useQuery({
    queryKey: [...planKey, start],
    queryFn: () => api.get(`/plan?from=${start}&to=${addDays(start!, 6)}`, PlanView),
    enabled: !!start,
    refetchInterval: 15_000,
    placeholderData: (prev) => prev,
  });
}

export function useRecent(enabled: boolean) {
  return useQuery({ queryKey: [...planKey, 'recent'], queryFn: () => api.get('/plan/recent', z.array(RecentItem)), enabled });
}

/** Every plan mutation refreshes the plan (and the recipe history it feeds). */
export function usePlanMutation<T>(fn: (vars: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: planKey });
      qc.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

export const planApi = {
  addEntries: (input: Partial<AddEntries> & Pick<AddEntries, 'dates' | 'rowId'>) => api.post('/plan/entries', input),
  moveEntry: ({ id, date, rowId, copy }: { id: number; date: string; rowId: number; copy?: boolean }) => api.patch(`/plan/entries/${id}`, { date, rowId, copy }),
  removeEntry: (id: number) => api.del(`/plan/entries/${id}`),
  copyWeek: ({ from, to }: { from: string; to: string }) => api.post('/plan/copy-week', { from, to }),
  addRow: (name: string) => api.post('/plan/rows', { name }),
  renameRow: ({ id, name }: { id: number; name: string }) => api.patch(`/plan/rows/${id}`, { name }),
  orderRows: (ids: number[]) => api.put('/plan/rows/order', { ids }),
  removeRow: (id: number) => api.del(`/plan/rows/${id}`),
  saveEvent: ({ id, ...e }: EventInput & { id?: number }) => (id ? api.patch(`/plan/events/${id}`, e) : api.post('/plan/events', e)),
  removeEvent: (id: number) => api.del(`/plan/events/${id}`),
};
