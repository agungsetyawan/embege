"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ChevronDown, ShieldCheck, Siren } from "lucide-react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TimelineArea = {
  province: string;
  district: string;
  victims: number;
};

type TimelineDay = {
  date: string;
  cases: number;
  victims: number;
  areas: TimelineArea[];
};

type TimelineResponse = {
  timeline: TimelineDay[];
  unknownDate: number;
  future: number;
};

async function fetchTimeline(): Promise<TimelineResponse> {
  const res = await fetch("/api/timeline");
  if (!res.ok) throw new Error("Gagal memuat data hari");
  return res.json();
}

// WIB is fixed at UTC+7 (no DST). Must match the API calculation.
function todayWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function toLocalDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function formatDate(iso: string): string {
  return format(toLocalDate(iso), "d MMMM yyyy", { locale: localeId });
}

// Safe days: Monday-Saturday since the first case that had no poisoning.
function countSafeDays(first: string, poisoned: Set<string>): number {
  let safe = 0;
  const d = toLocalDate(first);
  const today = toLocalDate(todayWIB());
  let guard = 0;
  while (d <= today && guard < 5000) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (d.getDay() !== 0 && !poisoned.has(iso)) safe += 1;
    d.setDate(d.getDate() + 1);
    guard += 1;
  }
  return safe;
}

function buildFootnote(unknownDate: number, future: number): string | null {
  const parts: string[] = [];
  if (unknownDate > 0) parts.push(`${unknownDate} kasus tanpa tanggal pasti`);
  if (future > 0) parts.push(`${future} kasus bertanggal masa depan`);
  if (parts.length === 0) return null;
  return `${parts.join(" dan ")} tidak dihitung`;
}

export function StatsCards() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["case-timeline"],
    queryFn: fetchTimeline,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading)
    return (
      <output
        className="grid grid-cols-2 gap-3"
        aria-busy="true"
        aria-label="Memuat penghitung hari"
      >
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </output>
    );

  if (isError || !data)
    return (
      <Card className="items-center gap-2 py-6 text-center">
        <p className="font-medium">Penghitung hari gagal dimuat.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Coba lagi
        </Button>
      </Card>
    );

  const { timeline, unknownDate, future } = data;
  const poisoned = new Set(timeline.map((t) => t.date));
  const first = timeline.length > 0 ? timeline[timeline.length - 1].date : null;
  const poisonedDays = timeline.length;
  const safeDays = first ? countSafeDays(first, poisoned) : 0;
  const footnote = buildFootnote(unknownDate, future);

  const cardBase =
    "flex flex-col gap-1 rounded-xl p-4 text-left ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden";
  const poisonCardClass = `${cardBase} bg-red-50 ring-red-200 hover:bg-red-100/70 dark:bg-red-950/40 dark:ring-red-900 dark:hover:bg-red-950/60`;
  const safeCardClass = `${cardBase} bg-green-50 ring-green-200 hover:bg-green-100/70 dark:bg-green-950/40 dark:ring-green-900 dark:hover:bg-green-950/60`;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) setExpanded(null);
      }}
    >
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-2 gap-3">
          <DialogTrigger
            className={poisonCardClass}
            aria-label="Lihat riwayat hari keracunan"
          >
            <span className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400">
              <Siren className="size-4" />
              Hari keracunan
            </span>
            <span className="text-2xl font-semibold tracking-tight text-red-700 dark:text-red-400">
              {poisonedDays.toLocaleString("id-ID")}
            </span>
            <span className="text-xs text-muted-foreground">
              {first ? `sejak ${formatDate(first)}` : "belum ada data"}
            </span>
          </DialogTrigger>
          <DialogTrigger
            className={safeCardClass}
            aria-label="Lihat riwayat hari tanpa keracunan"
          >
            <span className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
              <ShieldCheck className="size-4" />
              Hari tanpa keracunan
            </span>
            <span className="text-2xl font-semibold tracking-tight text-green-700 dark:text-green-400">
              {safeDays.toLocaleString("id-ID")}
            </span>
            <span className="text-xs text-muted-foreground">
              Senin sampai Sabtu, di luar hari berkasus
            </span>
          </DialogTrigger>
        </div>
        {footnote && (
          <p className="text-xs text-muted-foreground">*{footnote}</p>
        )}
      </div>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Riwayat hari keracunan</DialogTitle>
          <DialogDescription>
            {first
              ? `Sejak ${formatDate(first)}`
              : "Belum ada kasus bertanggal"}
          </DialogDescription>
        </DialogHeader>
        {timeline.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Belum ada data untuk ditampilkan.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Tanggal</th>
                <th className="py-2 pr-2 text-right font-medium">Kejadian</th>
                <th className="py-2 text-right font-medium">Korban</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((day) => {
                const open = expanded === day.date;
                return (
                  <Fragment key={day.date}>
                    <tr className="border-b">
                      <td className="py-2 pr-2">
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setExpanded(open ? null : day.date)}
                          className="flex items-center gap-1 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                        >
                          <ChevronDown
                            className={cn(
                              "size-4 transition-transform",
                              open && "rotate-180",
                            )}
                          />
                          {formatDate(day.date)}
                        </button>
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {day.cases}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {day.victims.toLocaleString("id-ID")}
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b bg-muted/50">
                        <td colSpan={3} className="px-4 py-2">
                          <ul className="flex flex-col gap-1">
                            {day.areas.map((a) => {
                              const name =
                                a.province === "Wilayah tak dikenal"
                                  ? "Wilayah tak dikenal"
                                  : a.district
                                    ? `${a.district}, ${a.province}`
                                    : a.province;
                              return (
                                <li
                                  key={`${a.province}/${a.district}`}
                                  className="flex items-baseline justify-between gap-2 text-sm"
                                >
                                  <span>{name}</span>
                                  <span className="text-muted-foreground tabular-nums">
                                    {a.victims.toLocaleString("id-ID")} korban
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
  );
}
