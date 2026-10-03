"use client";

import { Bot, MapPin, RotateCcw, Users, UserX } from "lucide-react";
import { Badge } from "@/components/reui/badge";
import {
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { SubmitButton } from "@/components/ui/submit-button";
import { restoreItem } from "./actions";
import type { RegionOption } from "./pending-item";

export type RejectedItemData = {
  id: string;
  title: string;
  url: string;
  media: string;
  published_at: string | null;
  guessed_region_id: string | null;
  llm_summary: string | null;
  llm_victims: number | null;
  llm_school: string | null;
  llm_sppg: string | null;
  llm_reject_reason: string | null;
  enrich_source: string | null;
};

export function RejectedItem({
  item,
  manual = false,
  region,
}: {
  item: RejectedItemData;
  manual?: boolean;
  region?: RegionOption;
}) {
  const date = item.published_at ? item.published_at.slice(0, 10) : null;
  const StatusIcon = manual ? UserX : Bot;
  const status = manual
    ? "Ditolak admin"
    : item.llm_reject_reason?.startsWith("Duplikat")
      ? "Duplikat otomatis"
      : "Ditolak otomatis";
  return (
    <FramePanel className="flex flex-col gap-3">
      <FrameHeader className="gap-1.5 p-0">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary">{item.media}</Badge>
          {date && <time dateTime={date}>{date}</time>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground empty:hidden">
          {item.enrich_source === "rss" && (
            <Badge variant="outline">Dari RSS</Badge>
          )}
          {region && (
            <Badge variant="outline">
              <MapPin />
              {region.district}, {region.province}
            </Badge>
          )}
          {item.llm_victims !== null && (
            <Badge variant="outline">
              <Users />
              {item.llm_victims} korban
            </Badge>
          )}
          {item.llm_school && (
            <Badge variant="outline">{item.llm_school.slice(0, 60)}</Badge>
          )}
          {item.llm_sppg && (
            <Badge variant="outline">{item.llm_sppg.slice(0, 60)}</Badge>
          )}
        </div>
        <FrameTitle className="text-[15px] font-medium leading-snug">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            {item.title}
          </a>
        </FrameTitle>
      </FrameHeader>
      {item.llm_summary && <p className="text-sm">{item.llm_summary}</p>}
      <FrameFooter className="gap-3 p-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2 text-sm">
          <StatusIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{status}</span>
            {item.llm_reject_reason && (
              <span className="text-muted-foreground">
                {item.llm_reject_reason}
              </span>
            )}
          </div>
        </div>
        <form action={restoreItem} className="shrink-0 self-end sm:self-auto">
          <input type="hidden" name="itemId" value={item.id} />
          <SubmitButton type="submit" variant="outline">
            <RotateCcw data-icon="inline-start" />
            Kembalikan
          </SubmitButton>
        </form>
      </FrameFooter>
    </FramePanel>
  );
}
