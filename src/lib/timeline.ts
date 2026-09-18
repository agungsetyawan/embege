import { endOfWeek, format, startOfWeek } from "date-fns";
import { id as localeId } from "date-fns/locale";

export type TimelineArea = {
  region_id: string | null;
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

export type Period = "weekly" | "monthly" | "yearly";

export type PeriodGroup = {
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

function toLocalDate(iso: string): Date {
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
  if (unknownDate > 0) parts.push(`${unknownDate} kasus tanpa tanggal`);
  if (future > 0) parts.push(`${future} kasus bertanggal masa depan`);
  if (parts.length === 0) return null;
  return `${parts.join(" dan ")}, tidak dihitung`;
}

export function areaName(a: TimelineArea): string {
  if (a.province === "Wilayah tak dikenal") return "Wilayah tak dikenal";
  return a.district ? `${a.district}, ${a.province}` : a.province;
}

function groupByKey(
  timeline: TimelineDay[],
  keyOf: (day: TimelineDay) => string,
  labelOf: (key: string, day: TimelineDay) => string,
): PeriodGroup[] {
  const groups = new Map<string, PeriodGroup>();
  for (const day of timeline) {
    const key = keyOf(day);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: labelOf(key, day), days: [], cases: 0, victims: 0 };
      groups.set(key, group);
    }
    group.days.push(day);
    group.cases += day.cases;
    group.victims += day.victims;
  }
  return [...groups.values()];
}

export function groupByMonth(timeline: TimelineDay[]): PeriodGroup[] {
  return groupByKey(
    timeline,
    (day) => day.date.slice(0, 7),
    (key) =>
      format(toLocalDate(`${key}-01`), "MMMM yyyy", { locale: localeId }),
  );
}

function formatWeekLabel(weekStart: Date, weekEnd: Date): string {
  const sameMonth =
    weekStart.getMonth() === weekEnd.getMonth() &&
    weekStart.getFullYear() === weekEnd.getFullYear();
  if (sameMonth) {
    return `${format(weekStart, "d")}-${format(weekEnd, "d MMM yyyy", { locale: localeId })}`;
  }
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
  if (sameYear) {
    return `${format(weekStart, "d MMM", { locale: localeId })}-${format(weekEnd, "d MMM yyyy", { locale: localeId })}`;
  }
  return `${format(weekStart, "d MMM yyyy", { locale: localeId })}-${format(weekEnd, "d MMM yyyy", { locale: localeId })}`;
}

export function groupByWeek(timeline: TimelineDay[]): PeriodGroup[] {
  const weekStartOf = (day: TimelineDay) =>
    startOfWeek(toLocalDate(day.date), { weekStartsOn: 1 });
  return groupByKey(
    timeline,
    (day) => format(weekStartOf(day), "yyyy-MM-dd"),
    (_, day) =>
      formatWeekLabel(
        weekStartOf(day),
        endOfWeek(toLocalDate(day.date), { weekStartsOn: 1 }),
      ),
  );
}

export function groupByYear(timeline: TimelineDay[]): PeriodGroup[] {
  return groupByKey(
    timeline,
    (day) => day.date.slice(0, 4),
    (key) => key,
  );
}

export function groupByPeriod(
  timeline: TimelineDay[],
  period: Period,
): PeriodGroup[] {
  if (period === "weekly") return groupByWeek(timeline);
  if (period === "yearly") return groupByYear(timeline);
  return groupByMonth(timeline);
}

export function formatDay(iso: string): string {
  return format(toLocalDate(iso), "EEEE, d MMM", { locale: localeId });
}
