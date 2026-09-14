"use client";

import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/reui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { type CaseHistoryEntry, getCaseHistory } from "./actions";
import type { CaseRow } from "./cases-table";

const ACTION_LABELS: Record<string, string> = {
  "case.update": "Mengubah",
  "case.delete": "Menghapus",
  "case.restore": "Memulihkan",
  "crawl.approve": "Menyetujui dari antrean",
  "report.apply_fix": "Menerapkan koreksi laporan",
  "report.move_case": "Memindahkan wilayah",
};

const FIELD_LABELS: Record<string, string> = {
  region_id: "Wilayah",
  occurred_on: "Tanggal",
  victims: "Korban",
  summary: "Ringkasan",
  source_url: "URL sumber",
  source_media: "Media",
  published: "Terbit",
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "kosong";
  if (typeof v === "boolean") return v ? "ya" : "tidak";
  const s = String(v);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

function EntryDiff({ diff }: { diff: CaseHistoryEntry["diff"] }) {
  if (!diff || typeof diff !== "object" || Object.keys(diff).length === 0)
    return null;
  return (
    <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
      {Object.entries(diff)
        .filter(([k]) => k !== "from_report" && k !== "from_item")
        .map(([k, v]) => (
          <li key={k}>
            {FIELD_LABELS[k] ?? k}:{" "}
            {v !== null &&
            typeof v === "object" &&
            "from" in (v as Record<string, unknown>) ? (
              <>
                {formatValue((v as { from: unknown }).from)} →{" "}
                <span className="text-foreground">
                  {formatValue((v as { to: unknown }).to)}
                </span>
              </>
            ) : (
              formatValue(v)
            )}
          </li>
        ))}
    </ul>
  );
}

export function HistoryDialog({
  row,
  onClose,
}: {
  row: CaseRow;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<CaseHistoryEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    getCaseHistory(row.id).then((data) => {
      if (alive) setEntries(data);
    });
    return () => {
      alive = false;
    };
  }, [row.id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Riwayat aksi</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
          {entries === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Memuat riwayat...
            </p>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-6 text-center">
              <History className="size-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Belum ada aksi tercatat untuk case ini. Aksi baru akan tercatat
                di sini.
              </p>
            </div>
          ) : (
            entries.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-0.5 border-b border-border pb-2.5 last:border-0"
              >
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <Badge variant="outline">
                    {ACTION_LABELS[e.action] ?? e.action}
                  </Badge>
                  <span className="font-medium">
                    {e.actor_email ?? "tak dikenal"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {e.created_at.slice(0, 16).replace("T", " ")}
                </span>
                <EntryDiff diff={e.diff} />
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
