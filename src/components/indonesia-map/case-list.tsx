"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Ambulance, ExternalLink, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { Alert, AlertAction, AlertTitle } from "../reui/alert";
import { Badge } from "../reui/badge";
import { IconTile } from "../reui/icon-tile";
import { Button } from "../ui/button";
import { ButtonGroup } from "../ui/button-group";
import { Skeleton } from "../ui/skeleton";
import { CASE_STALE_TIME, fetchRegionCases } from "./api";
import { ShareButton } from "./share-button";

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

export function CaseList({
  regionId,
  highlightDate,
}: {
  regionId: string;
  highlightDate?: string | null;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["cases", regionId],
    queryFn: () => fetchRegionCases(regionId),
    staleTime: CASE_STALE_TIME,
  });
  const listRef = useRef<HTMLUListElement | null>(null);

  // Jump to the first case of the date that led here (e.g. from the timeline).
  useEffect(() => {
    if (!highlightDate || !data) return;
    listRef.current
      ?.querySelector(`[data-occurred-on="${highlightDate}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightDate, data]);

  if (isLoading)
    return (
      <output
        className="flex flex-col gap-4"
        aria-busy="true"
        aria-label="Memuat daftar kasus"
      >
        {["case-1", "case-2", "case-3"].map((id) => (
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
    <ul ref={listRef} className="flex flex-col">
      {data.cases.map((c) => (
        <li
          key={c.id}
          data-occurred-on={c.occurred_on?.slice(0, 10) ?? ""}
          className={`flex flex-col gap-1 border-t py-3 first:border-t-0 first:pt-0${
            highlightDate && c.occurred_on?.slice(0, 10) === highlightDate
              ? " -mx-2 rounded-lg bg-accent px-2 ring-1 ring-border"
              : ""
          }`}
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
          {(c.school || c.sppg) && (
            <p className="text-xs text-muted-foreground">
              {[c.school, c.sppg].filter(Boolean).join(" · ")}
            </p>
          )}
          <a
            href={c.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4"
          >
            <ExternalLink className="size-3.5" />
            {c.source_media}
          </a>
          <ButtonGroup className="ml-auto">
            <ReportDialog caseId={c.id} />
            <ShareButton
              regionId={c.region_id}
              date={c.occurred_on}
              title={`Kasus keracunan ${formatCaseDate(c.occurred_on)}`}
              label={`Bagikan kasus ${formatCaseDate(c.occurred_on)}`}
            />
          </ButtonGroup>
        </li>
      ))}
    </ul>
  );
}
