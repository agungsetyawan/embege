"use client";

import { useQuery } from "@tanstack/react-query";
import { type ColumnDef, useTable } from "@tanstack/react-table";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  ShieldCheck,
  Siren,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { Alert, AlertAction, AlertTitle } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import {
  DataGrid,
  DataGridContainer,
  type DataGridFeatures,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { IconTile } from "@/components/reui/icon-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

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
  while (d <= today) {
    const iso = format(d, "yyyy-MM-dd");
    if (d.getDay() !== 0 && !poisoned.has(iso)) safe += 1;
    d.setDate(d.getDate() + 1);
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

function areaName(a: TimelineArea): string {
  if (a.province === "Wilayah tak dikenal") return "Wilayah tak dikenal";
  return a.district ? `${a.district}, ${a.province}` : a.province;
}

type MonthGroup = {
  key: string;
  label: string;
  days: TimelineDay[];
  cases: number;
  victims: number;
};

function groupByMonth(timeline: TimelineDay[]): MonthGroup[] {
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

function formatDay(iso: string): string {
  return format(toLocalDate(iso), "EEEE, d", { locale: localeId });
}

function MonthGrid({ days }: { days: TimelineDay[] }) {
  const columns = useMemo<ColumnDef<DataGridFeatures, TimelineDay>[]>(
    () => [
      {
        id: "expander",
        header: () => null,
        cell: ({ row }) => {
          if (!row.getCanExpand()) return null;
          const isExpanded = row.getIsExpanded();
          return (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={row.getToggleExpandedHandler()}
              aria-expanded={isExpanded}
              aria-label={
                isExpanded ? "Tutup rincian hari" : "Lihat rincian hari"
              }
            >
              <ChevronDown className={isExpanded ? "rotate-180" : ""} />
            </Button>
          );
        },
        size: 36,
        meta: {
          expandedContent: (day: TimelineDay) => (
            <ul className="flex flex-col gap-0.5 py-2">
              {day.areas.map((a) => (
                <li key={`${a.province}/${a.district}`} className="text-sm">
                  <span className="font-medium">{areaName(a)}</span>{" "}
                  <span className="text-muted-foreground tabular-nums">
                    · {a.victims.toLocaleString("id-ID")} korban
                  </span>
                </li>
              ))}
            </ul>
          ),
        },
      },
      {
        accessorKey: "date",
        id: "date",
        header: "Tanggal",
        cell: ({ row }) => (
          <span className="font-medium">{formatDay(row.original.date)}</span>
        ),
        size: 140,
      },
      {
        accessorKey: "cases",
        id: "cases",
        header: "Kejadian",
        cell: ({ row }) => (
          <Badge variant="destructive-light" size="sm">
            {row.original.cases} kejadian
          </Badge>
        ),
        size: 130,
      },
      {
        accessorKey: "victims",
        id: "victims",
        header: "Korban",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.victims.toLocaleString("id-ID")}
          </span>
        ),
        size: 140,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
    ],
    [],
  );

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: days,
    getRowId: (row) => row.date,
    getRowCanExpand: (row) => row.original.areas.length > 0,
    state: { pagination: { pageIndex: 0, pageSize: 100 } },
  });

  return (
    <DataGrid
      table={table}
      recordCount={days.length}
      tableLayout={{ headerBackground: false, width: "auto" }}
    >
      <DataGridContainer>
        <DataGridScrollArea>
          <DataGridTable />
        </DataGridScrollArea>
      </DataGridContainer>
    </DataGrid>
  );
}

export function StatsCards() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["case-timeline"],
    queryFn: fetchTimeline,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading)
    return (
      <output
        className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
        aria-busy="true"
        aria-label="Memuat penghitung hari"
      >
        <Skeleton className="h-[150px] w-full rounded-xl" />
        <Skeleton className="h-[150px] w-full rounded-xl" />
        <Skeleton className="h-[150px] w-full rounded-xl" />
        <Skeleton className="h-[150px] w-full rounded-xl" />
      </output>
    );

  if (isError || !data)
    return (
      <Alert variant="destructive">
        <AlertTitle>Penghitung hari gagal dimuat.</AlertTitle>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Coba lagi
          </Button>
        </AlertAction>
      </Alert>
    );

  const { timeline, unknownDate, future } = data;
  const months = groupByMonth(timeline);
  const poisoned = new Set(timeline.map((t) => t.date));
  const first = timeline.at(-1)?.date ?? null;
  const poisonedDays = timeline.length;
  const safeDays = first ? countSafeDays(first, poisoned) : 0;
  const totalCases = timeline.reduce((t, d) => t + d.cases, 0);
  const totalVictims = timeline.reduce((t, d) => t + d.victims, 0);
  const footnote = buildFootnote(unknownDate, future);

  // DialogTrigger renders a native <button>, so the clickable cards replicate
  // the Card visuals (same radius, ring, spacing) instead of nesting a <div>.
  const triggerBase =
    "group flex cursor-pointer flex-col gap-2 overflow-hidden rounded-xl bg-card py-3 text-left text-sm text-card-foreground ring-1 ring-foreground/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden";
  const poisonCardClass = `${triggerBase} hover:ring-destructive/30`;
  const numberClass =
    "text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl";
  const chevronClass =
    "size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5";

  return (
    <Dialog>
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <Card size="sm" className="gap-2">
            <CardHeader>
              <span className="flex items-center gap-2">
                <IconTile variant="soft" size="sm" className="text-info">
                  <FileText />
                </IconTile>
                <span className="text-sm font-medium text-muted-foreground">
                  Kasus
                </span>
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <span className={numberClass}>
                {totalCases.toLocaleString("id-ID")}
              </span>
              <Badge variant="info-light" size="sm" radius="full">
                laporan terkurasi
              </Badge>
            </CardContent>
          </Card>
          <Card size="sm" className="gap-2">
            <CardHeader>
              <span className="flex items-center gap-2">
                <IconTile variant="soft" size="sm" className="text-warning">
                  <Users />
                </IconTile>
                <span className="text-sm font-medium text-muted-foreground">
                  Korban
                </span>
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <span className={numberClass}>
                {totalVictims.toLocaleString("id-ID")}
              </span>
              <Badge variant="warning-light" size="sm" radius="full">
                jiwa terdampak
              </Badge>
            </CardContent>
          </Card>
          <DialogTrigger
            className={poisonCardClass}
            aria-label="Lihat riwayat hari keracunan"
          >
            <span className="flex items-center justify-between gap-2 px-3">
              <span className="flex items-center gap-2">
                <IconTile variant="soft" size="sm" className="text-destructive">
                  <Siren />
                </IconTile>
                <span className="text-sm font-medium text-muted-foreground">
                  Hari keracunan
                </span>
              </span>
              <ChevronRight className={chevronClass} aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-1.5 px-3">
              <span className={numberClass}>
                {poisonedDays.toLocaleString("id-ID")}
              </span>
              <Badge variant="destructive-light" size="sm" radius="full">
                {first ? `sejak ${formatDate(first)}` : "belum ada data"}
              </Badge>
            </span>
          </DialogTrigger>
          <Card size="sm" className="gap-2">
            <CardHeader>
              <span className="flex items-center gap-2">
                <IconTile variant="soft" size="sm" className="text-success">
                  <ShieldCheck />
                </IconTile>
                <span className="text-sm font-medium text-muted-foreground">
                  Hari tanpa keracunan
                </span>
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5">
              <span className={numberClass}>
                {safeDays.toLocaleString("id-ID")}
              </span>
              <Badge variant="success-light" size="sm" radius="full">
                di luar hari berkasus
              </Badge>
            </CardContent>
          </Card>
        </div>
        {footnote && (
          <p className="text-xs text-muted-foreground">*{footnote}</p>
        )}
      </div>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
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
          <div className="flex flex-col gap-5">
            {months.map((month) => (
              <section key={month.key} aria-label={month.label}>
                <div className="sticky top-0 z-10 -mx-1 bg-popover px-1 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{month.label}</h3>
                    <Badge variant="destructive-light" size="sm">
                      {month.cases} kejadian
                    </Badge>
                    <Badge variant="outline" size="sm">
                      {month.victims.toLocaleString("id-ID")} korban
                    </Badge>
                  </div>
                </div>
                <MonthGrid days={month.days} />
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
