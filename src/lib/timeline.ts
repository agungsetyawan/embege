import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export type TimelineArea = {
  province: string;
  district: string;
  victims: number;
};

export type TimelineDay = {
  date: string;
  cases: number;
  victims: number;
  areas: TimelineArea[];
};

export type TimelineResponse = {
  timeline: TimelineDay[];
  unknownDate: number;
  future: number;
};

export type MonthGroup = {
  key: string;
  label: string;
  days: TimelineDay[];
  cases: number;
  victims: number;
};

// WIB is fixed at UTC+7 (no DST). Must match the API calculation.
export function todayWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export function toLocalDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function formatDate(iso: string): string {
  return format(toLocalDate(iso), "d MMMM yyyy", { locale: localeId });
}

// Safe days: Monday-Saturday since the first case that had no poisoning.
export function countSafeDays(first: string, poisoned: Set<string>): number {
  let safe = 0;
  const d = toLocalDate(first);
  const today = toLocalDate(todayWIB());
  while (d <= today) {
    const iso = format(d, "yyyy-MM-dd");
    if (d.getDay() !== 0 && !poisoned.has(iso)) safe += 1;
    d.setDate(d.getDate() + 1);
  }
  return safe;
}

export function buildFootnote(
  unknownDate: number,
  future: number,
): string | null {
  const parts: string[] = [];
  if (unknownDate > 0) parts.push(`${unknownDate} kasus tanpa tanggal pasti`);
  if (future > 0) parts.push(`${future} kasus bertanggal masa depan`);
  if (parts.length === 0) return null;
  return `${parts.join(" dan ")} tidak dihitung`;
}

export function areaName(a: TimelineArea): string {
  if (a.province === "Wilayah tak dikenal") return "Wilayah tak dikenal";
  return a.district ? `${a.district}, ${a.province}` : a.province;
}

export function groupByMonth(timeline: TimelineDay[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const day of timeline) {
    const key = day.date.slice(0, 7);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: format(toLocalDate(`${key}-01`), "MMMM yyyy", {
          locale: localeId,
        }),
        days: [],
        cases: 0,
        victims: 0,
      };
      groups.set(key, group);
    }
    group.days.push(day);
    group.cases += day.cases;
    group.victims += day.victims;
  }
  return [...groups.values()];
}

export function formatDay(iso: string): string {
  return format(toLocalDate(iso), "EEEE, d", { locale: localeId });
}
