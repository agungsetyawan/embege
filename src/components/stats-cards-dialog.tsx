"use client";

import { type ColumnDef, useTable } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Siren } from "lucide-react";
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
import { IconTile } from "@/components/reui/icon-tile";
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
import {
  areaName,
  formatDate,
  formatDay,
  groupByPeriod,
  type Period,
  type TimelineDay,
} from "@/lib/timeline";

const periodLabels: Record<Period, string> = {
  weekly: "Mingguan",
  monthly: "Bulanan",
  yearly: "Tahunan",
};

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
            <ChevronDown className={isExpanded ? "rotate-180" : ""} />
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
                      className="cursor-pointer text-left font-medium underline-offset-4 hover:underline"
                    >
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
      cell: ({ row }) => (
        <span className="font-medium">{formatDay(row.original.date)}</span>
      ),
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

export function StatsCardsDialog({
  timeline,
  first,
  poisonedDays,
}: {
  timeline: TimelineDay[];
  first: string | null;
  poisonedDays: number;
}) {
  // DialogTrigger renders a native <button>, so the clickable cards replicate
  // the Card visuals (same radius, ring, spacing) instead of nesting a <div>.
  const triggerBase =
    "group flex cursor-pointer flex-col gap-2 overflow-hidden rounded-xl bg-card py-3 text-left text-sm text-card-foreground ring-1 ring-foreground/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden";
  const poisonCardClass = `${triggerBase} hover:ring-destructive/30`;
  const numberClass =
    "text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl";
  const chevronClass =
    "size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5";

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("monthly");
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
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b pb-3">
          <DialogTitle>Riwayat hari keracunan</DialogTitle>
          <div className="flex items-center gap-2 pt-1">
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
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {groups.length === 0 ? (
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
