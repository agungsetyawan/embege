"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Ambulance, ExternalLink, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { Alert, AlertAction, AlertTitle } from "../reui/alert";
import { Badge } from "../reui/badge";
import { IconTile } from "../reui/icon-tile";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { CASE_STALE_TIME, fetchRegionCases } from "./api";

const ReportDialog = dynamic(
  () => import("../report-dialog").then((m) => m.ReportDialog),
  { ssr: false },
);

function formatCaseDate(iso: string | null): string {
  if (!iso) return "Tanggal belum diketahui";
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return format(parsed, "d MMMM yyyy", { locale: localeId });
}

export function CaseList({ regionId }: { regionId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["cases", regionId],
    queryFn: () => fetchRegionCases(regionId),
    staleTime: CASE_STALE_TIME,
  });

  if (isLoading)
    return (
      <output
        className="flex flex-col gap-4"
        aria-busy="true"
        aria-label="Memuat daftar kasus"
      >
        {["kasus-1", "kasus-2", "kasus-3"].map((id) => (
          <div key={id} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </output>
    );
  if (isError || !data)
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Daftar kasus gagal dimuat.</AlertTitle>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Coba lagi
          </Button>
        </AlertAction>
      </Alert>
    );
  if (data.cases.length === 0)
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Belum ada kasus untuk daerah ini.
      </p>
    );

  return (
    <ul className="flex flex-col">
      {data.cases.map((c) => (
        <li
          key={c.id}
          className="flex flex-col gap-1 border-t py-3 first:border-t-0 first:pt-0"
        >
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <IconTile variant="soft" size="xs" className="text-destructive">
              <Ambulance />
            </IconTile>
            <span>{formatCaseDate(c.occurred_on)}</span>
            {c.victims !== null && (
              <Badge variant="secondary" size="sm">
                {c.victims.toLocaleString("id-ID")} korban
              </Badge>
            )}
          </div>
          <p className="text-sm leading-relaxed">{c.summary}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href={c.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4"
            >
              <ExternalLink className="size-3.5" />
              {c.source_media}
            </a>
            <ReportDialog caseId={c.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}
