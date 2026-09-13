"use client";

import { type ColumnDef, useTable } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Siren } from "lucide-react";
import { useMemo } from "react";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  areaName,
  formatDate,
  formatDay,
  type MonthGroup,
  type TimelineDay,
} from "@/lib/timeline";

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

export function StatsCardsDialog({
  months,
  first,
  poisonedDays,
}: {
  months: MonthGroup[];
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

  return (
    <Dialog>
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Riwayat hari keracunan</DialogTitle>
          <DialogDescription>
            {first
              ? `Sejak ${formatDate(first)}`
              : "Belum ada kasus bertanggal"}
          </DialogDescription>
        </DialogHeader>
        {months.length === 0 ? (
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
