"use client";

import { useQuery } from "@tanstack/react-query";
import { type ColumnDef, useTable } from "@tanstack/react-table";
import { ChevronDown, History, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/reui/badge";
import {
  DataGrid,
  DataGridContainer,
  type DataGridFeatures,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  areaName,
  formatDate,
  formatDay,
  groupByPeriod,
  type Period,
  type TimelineDay,
} from "@/lib/timeline";
import { CASE_STALE_TIME, fetchTimeline } from "./api";

const periodLabels: Record<Period, string> = {
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

const TrendChart = dynamic(
  () => import("@/components/trend-chart").then((m) => m.TrendChart),
  {
    ssr: false,
    loading: () => (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Memuat grafik…
      </p>
    ),
  },
);

type View = "list" | "chart";

function MonthGrid({
  days,
  onSelectArea,
}: {
  days: TimelineDay[];
  onSelectArea: (regionId: string, date: string) => void;
}) {
  const monthColumns: ColumnDef<DataGridFeatures, TimelineDay>[] = [
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
            <ChevronDown
              className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          </Button>
        );
      },
      size: 36,
      meta: {
        expandedContent: (day: TimelineDay) => (
          <ul className="flex flex-col gap-0.5 py-2">
            {day.areas.map((a) => {
              // No region_id (e.g. unknown regions): plain text, cannot open the map drawer.
              const regionId = a.region_id;
              return (
                <li
                  key={regionId ?? `${a.province}/${a.district}`}
                  className="text-sm"
                >
                  {regionId ? (
                    <button
                      type="button"
                      onClick={() => onSelectArea(regionId, day.date)}
                      aria-label={`Lihat kasus di ${areaName(a)} pada ${formatDate(day.date)}`}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-left font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                    >
                      <MapPin
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {areaName(a)}
                    </button>
                  ) : (
                    <span className="font-medium">{areaName(a)}</span>
                  )}{" "}
                  <span className="text-muted-foreground tabular-nums">
                    · {a.victims.toLocaleString("id-ID")} korban
                  </span>
                </li>
              );
            })}
          </ul>
        ),
      },
    },
    {
      accessorKey: "date",
      id: "date",
      header: "Tanggal",
      cell: ({ row }) => {
        if (!row.getCanExpand()) {
          return (
            <span className="font-medium">{formatDay(row.original.date)}</span>
          );
        }
        const isExpanded = row.getIsExpanded();
        return (
          <button
            type="button"
            onClick={row.getToggleExpandedHandler()}
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? `Tutup rincian ${formatDay(row.original.date)}`
                : `Lihat rincian ${formatDay(row.original.date)}`
            }
            className="cursor-pointer rounded-sm text-left font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            {formatDay(row.original.date)}
          </button>
        );
      },
      size: 140,
    },
    {
      accessorKey: "cases",
      id: "cases",
      header: "Kasus",
      cell: ({ row }) => (
        <Badge variant="destructive-light" size="sm" className="tabular-nums">
          {row.original.cases.toLocaleString("id-ID")}
        </Badge>
      ),
      size: 130,
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center",
      },
    },
    {
      accessorKey: "victims",
      id: "victims",
      header: "Korban",
      cell: ({ row }) => (
        <Badge variant="outline" size="sm" className="tabular-nums">
          {row.original.victims.toLocaleString("id-ID")}
        </Badge>
      ),
      size: 140,
      meta: {
        headerClassName: "text-right",
        cellClassName: "text-right",
      },
    },
  ];

  const table = useTable({
    features: dataGridFeatures,
    columns: monthColumns,
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

// Poisoning-days timeline inside the map card. The pill button stays visible
// at the bottom center of the map; data + DataGrid + chart load only on open.
export function TimelineHistoryDialog({
  container,
  onOpenChange,
}: {
  // Mount the dialog portal here so it renders above the expanded card
  // (which sits above the body portal via z-index).
  container?: HTMLElement;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("monthly");
  const [view, setView] = useState<View>("list");

  const history = useQuery({
    queryKey: ["timeline"],
    queryFn: fetchTimeline,
    enabled: open,
    staleTime: CASE_STALE_TIME,
  });
  const timeline = useMemo(() => history.data?.timeline ?? [], [history.data]);
  const groups = useMemo(
    () => groupByPeriod(timeline, period),
    [timeline, period],
  );

  // Same destination as the map search: the map flies to the region and
  // opens its drawer, which highlights the cases of this date.
  const handleSelectArea = (regionId: string, date: string) => {
    setOpen(false);
    const query = new URLSearchParams({
      region_id: regionId,
      date,
    }).toString();
    router.replace(`?${query}`, { scroll: false });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      <DialogTrigger
        aria-label="Lihat linimasa hari keracunan"
        className="absolute bottom-3 left-1/2 z-1000 inline-flex h-8 -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium whitespace-nowrap shadow-md transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden dark:bg-background"
      >
        <History className="size-4" aria-hidden="true" />
        Linimasa
      </DialogTrigger>
      <DialogContent
        container={container}
        className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 border-b pb-3">
          <DialogTitle>Linimasa hari keracunan</DialogTitle>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              <label htmlFor="period" className="text-sm text-muted-foreground">
                Periode
              </label>
              <Select
                value={period}
                onValueChange={(value) => setPeriod(value as Period)}
              >
                <SelectTrigger id="period" size="sm" className="min-w-32">
                  <SelectValue>{() => periodLabels[period]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Mingguan</SelectItem>
                  <SelectItem value="monthly">Bulanan</SelectItem>
                  <SelectItem value="yearly">Tahunan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Tabs
              value={view}
              onValueChange={(v) => setView(v as View)}
              aria-label="Pilih tampilan linimasa"
            >
              <TabsList>
                <TabsTrigger value="list">Daftar</TabsTrigger>
                <TabsTrigger value="chart">Grafik</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {history.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Memuat linimasa…
            </p>
          ) : history.isError ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="text-sm text-muted-foreground">
                Linimasa gagal dimuat.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void history.refetch()}
              >
                Coba lagi
              </Button>
            </div>
          ) : view === "chart" ? (
            <TrendChart groups={groups} />
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada data untuk ditampilkan.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <section key={group.key} aria-label={group.label}>
                  <div className="sticky top-0 z-10 bg-popover py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{group.label}</h3>
                      <Badge variant="destructive-light" size="sm">
                        {group.cases} kasus
                      </Badge>
                      <Badge variant="outline" size="sm">
                        {group.victims.toLocaleString("id-ID")} korban
                      </Badge>
                    </div>
                  </div>
                  <MonthGrid
                    days={group.days}
                    onSelectArea={handleSelectArea}
                  />
                </section>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
