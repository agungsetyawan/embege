"use client";

import { type ColumnDef, useTable } from "@tanstack/react-table";
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

export type CronLogRow = {
  id: number;
  job_kind: string;
  status_code: number | null;
  timed_out: boolean | null;
  error_msg: string | null;
  content: string | null;
  created: string;
  full_count: number;
};

function asNum(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// One-line summary of a cron endpoint response body.
function summarize(row: CronLogRow): string {
  if (!row.content) return row.error_msg ?? "No response.";
  try {
    const data = JSON.parse(row.content) as Record<string, unknown>;
    if (row.job_kind === "crawl") {
      return (
        `${asNum(data.keywords)} keywords, ` +
        `${asNum(data.fetched)} fetched, ${asNum(data.inserted)} new`
      );
    }
    return (
      `${asNum(data.processed)} processed, ` +
      `${asNum(data.enriched)} enriched, ${asNum(data.failed)} failed`
    );
  } catch {
    return row.content.slice(0, 200);
  }
}

// No column sorts (server pages via ?page=), so plain centered headers suffice.
const headerCenter = {
  headerClassName: "text-center",
} as const;

export function CronLogsTable({ rows }: { rows: CronLogRow[] }) {
  const columns = useMemo<ColumnDef<DataGridFeatures, CronLogRow>[]>(
    () => [
      {
        id: "created",
        accessorKey: "created",
        enableSorting: false,
        meta: headerCenter,
        size: 130,
        header: "Time",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm tabular-nums">
            {new Date(row.original.created).toLocaleString("en-GB", {
              timeZone: "Asia/Jakarta",
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ),
      },
      {
        id: "job_kind",
        accessorKey: "job_kind",
        enableSorting: false,
        meta: headerCenter,
        size: 90,
        header: "Job",
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.job_kind}</Badge>
        ),
      },
      {
        id: "status",
        accessorKey: "status_code",
        enableSorting: false,
        meta: headerCenter,
        size: 90,
        header: "Status",
        cell: ({ row }) => {
          const r = row.original;
          const failed =
            r.timed_out === true ||
            (r.status_code !== null && r.status_code >= 400);
          return (
            <Badge variant={failed ? "destructive" : "success"}>
              {r.timed_out === true
                ? "Timed out"
                : (r.status_code ?? "No status")}
            </Badge>
          );
        },
      },
      {
        id: "summary",
        accessorKey: "content",
        enableSorting: false,
        meta: { fillWidth: true, ...headerCenter },
        minSize: 220,
        header: "Summary",
        cell: ({ row }) => {
          const text = summarize(row.original);
          return (
            <span className="block text-sm text-muted-foreground" title={text}>
              {text}
            </span>
          );
        },
      },
    ],
    [],
  );

  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    getRowId: (row) => String(row.id),
    // One server page is shown as-is; URL ?page= (QueuePagination) handles paging.
    state: { pagination: { pageIndex: 0, pageSize: Math.max(rows.length, 1) } },
  });

  return (
    <DataGridContainer>
      <DataGrid
        table={table}
        recordCount={rows.length}
        i18n={{
          labels: {
            empty: "Belum ada cron log.",
            loading: "Memuat...",
          },
        }}
      >
        <DataGridScrollArea>
          <DataGridTable />
        </DataGridScrollArea>
      </DataGrid>
    </DataGridContainer>
  );
}
