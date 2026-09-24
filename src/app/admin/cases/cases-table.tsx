"use client";

import {
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import {
  ExternalLink,
  History,
  Pencil,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/reui/badge";
import {
  DataGrid,
  DataGridContainer,
  type DataGridFeatures,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { restoreCase } from "../actions";
import type { RegionOption } from "../pending-item";
import { deleteCase } from "./actions";
import { EditCaseDialog } from "./edit-case-dialog";
import { HistoryDialog } from "./history-dialog";

export type CaseRow = {
  id: string;
  region_id: string;
  summary: string;
  school: string | null;
  sppg: string | null;
  victims: number | null;
  occurred_on: string | null;
  source_media: string;
  source_url: string;
  published: boolean;
  created_at: string;
  deleted_at: string | null;
  region: {
    province: string;
    district: string;
    centroid_ok: boolean;
  } | null;
};

type KeptParams = {
  search: string;
  regionId: string;
  status: string;
  published: string;
};

// Centered header text; the child selector also centers the sort button
// rendered by DataGridColumnHeader inside its full-width flex wrapper.
const headerCenter = {
  headerClassName: "text-center [&>div]:justify-center",
} as const;

function pushWith(
  router: ReturnType<typeof useRouter>,
  kept: KeptParams,
  base: { sort: string; order: string; per: number },
  patch: { sort?: string; order?: string; per?: number; page?: number },
) {
  const params = new URLSearchParams();
  if (kept.search) params.set("search", kept.search);
  if (kept.regionId) params.set("regionId", kept.regionId);
  if (kept.status !== "active") params.set("status", kept.status);
  if (kept.published !== "all") params.set("published", kept.published);
  params.set("sort", patch.sort ?? base.sort);
  params.set("order", patch.order ?? base.order);
  params.set("per", String(patch.per ?? base.per));
  params.set("page", String(patch.page ?? 1));
  router.push(`/admin/cases?${params.toString()}`);
}

export function CasesTable({
  rows,
  total,
  page,
  per,
  sort,
  order,
  kept,
  regions,
}: {
  rows: CaseRow[];
  total: number;
  page: number;
  per: number;
  sort: string;
  order: string;
  kept: KeptParams;
  regions: RegionOption[];
}) {
  const router = useRouter();
  const [editRow, setEditRow] = useState<CaseRow | null>(null);
  const [historyRow, setHistoryRow] = useState<CaseRow | null>(null);
  const [confirmRow, setConfirmRow] = useState<CaseRow | null>(null);

  const columns = useMemo<ColumnDef<DataGridFeatures, CaseRow>[]>(
    () => [
      {
        id: "occurred_on",
        accessorKey: "occurred_on",
        meta: headerCenter,
        size: 105,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Tanggal" />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">
            {row.original.occurred_on ?? "-"}
          </span>
        ),
      },
      {
        id: "summary",
        accessorKey: "summary",
        enableSorting: false,
        meta: { fillWidth: true, ...headerCenter },
        minSize: 220,
        header: "Ringkasan",
        cell: ({ row }) => (
          <div className="flex max-w-md flex-col">
            <p className="truncate text-sm" title={row.original.summary}>
              {row.original.summary}
            </p>
            {(row.original.school || row.original.sppg) && (
              <p className="truncate text-xs text-muted-foreground">
                {[row.original.school, row.original.sppg]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "region",
        accessorKey: "region",
        enableSorting: false,
        meta: headerCenter,
        size: 150,
        header: "Wilayah",
        cell: ({ row }) => {
          const r = row.original.region;
          if (!r) return <span className="text-sm">-</span>;
          return (
            <span className="flex max-w-44 items-center gap-1 text-sm">
              <span className="truncate">
                {r.district ? `${r.district}, ` : ""}
                {r.province}
              </span>
              {!r.centroid_ok && (
                <TriangleAlert
                  className="size-3.5 shrink-0 text-amber-500"
                  aria-label="Koordinat belum terverifikasi"
                />
              )}
            </span>
          );
        },
      },
      {
        id: "victims",
        accessorKey: "victims",
        meta: headerCenter,
        size: 88,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Korban" />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm tabular-nums">
            {row.original.victims ?? "-"}
          </span>
        ),
      },
      {
        id: "source",
        accessorKey: "source_media",
        enableSorting: false,
        meta: headerCenter,
        size: 130,
        header: "Sumber",
        cell: ({ row }) => (
          <a
            href={row.original.source_url}
            target="_blank"
            rel="noreferrer"
            className="flex max-w-40 items-center gap-1 text-sm underline underline-offset-4"
          >
            <span className="truncate">{row.original.source_media}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ),
      },
      {
        id: "published",
        accessorKey: "published",
        enableSorting: false,
        meta: headerCenter,
        size: 80,
        header: "Terbit",
        cell: ({ row }) =>
          row.original.published ? (
            <Badge>Terbit</Badge>
          ) : (
            <Badge variant="outline">Draft</Badge>
          ),
      },
      {
        id: "aksi",
        enableSorting: false,
        meta: headerCenter,
        size: 132,
        minSize: 132,
        header: "Aksi",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Ubah ${c.summary.slice(0, 30)}`}
                onClick={() => setEditRow(c)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Riwayat aksi"
                onClick={() => setHistoryRow(c)}
              >
                <History className="size-3.5" />
              </Button>
              {c.deleted_at ? (
                <form action={restoreCase}>
                  <input type="hidden" name="caseId" value={c.id} />
                  <Button
                    variant="ghost"
                    size="sm"
                    type="submit"
                    aria-label="Pulihkan"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                </form>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Hapus"
                  onClick={() => setConfirmRow(c)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [],
  );

  const sorting: SortingState = useMemo(
    () =>
      sort === "occurred_on" || sort === "victims"
        ? [{ id: sort, desc: order !== "asc" }]
        : [],
    [sort, order],
  );

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    const first = next[0];
    const patch =
      first && ["occurred_on", "created_at", "victims"].includes(first.id)
        ? { sort: first.id, order: first.desc ? "desc" : "asc" }
        : { sort: "occurred_on", order: "desc" };
    pushWith(router, kept, { sort, order, per }, patch);
  };

  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const current = { pageIndex: page - 1, pageSize: per };
    const next = typeof updater === "function" ? updater(current) : updater;
    pushWith(
      router,
      kept,
      { sort, order, per },
      { page: next.pageIndex + 1, per: next.pageSize },
    );
  };

  const table = useTable({
    features: dataGridFeatures,
    data: rows,
    columns,
    getRowId: (row) => row.id,
    state: {
      pagination: { pageIndex: page - 1, pageSize: per },
      sorting,
    },
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(total / per)),
    onPaginationChange,
    onSortingChange,
  });

  return (
    <>
      <DataGridContainer>
        <DataGrid
          table={table}
          recordCount={total}
          i18n={{
            labels: {
              rowsPerPage: "Baris per halaman",
              paginationInfo: ({ from, to, count }) =>
                `${from}–${to} dari ${count}`,
              previousPage: "Halaman sebelumnya",
              nextPage: "Halaman berikutnya",
              goToPage: (p) => `Ke halaman ${p}`,
              empty: "Belum ada case.",
              loading: "Memuat...",
            },
          }}
        >
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
          <DataGridPagination sizes={[10, 20, 50]} />
        </DataGrid>
      </DataGridContainer>
      {editRow && (
        <EditCaseDialog
          key={editRow.id}
          row={editRow}
          regions={regions}
          onClose={() => setEditRow(null)}
        />
      )}
      {historyRow && (
        <HistoryDialog row={historyRow} onClose={() => setHistoryRow(null)} />
      )}
      {confirmRow && (
        <ConfirmDeleteDialog
          row={confirmRow}
          onClose={() => setConfirmRow(null)}
        />
      )}
    </>
  );
}

function ConfirmDeleteDialog({
  row,
  onClose,
}: {
  row: CaseRow;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Hapus case ini?</DialogTitle>
        </DialogHeader>
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {row.summary}
        </p>
        <p className="text-xs text-muted-foreground">
          Dihapus lunak, bisa dipulihkan dari filter Terhapus.
        </p>
        <form action={deleteCase} onSubmit={onClose}>
          <input type="hidden" name="caseId" value={row.id} />
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" variant="destructive" size="sm">
              Hapus
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
