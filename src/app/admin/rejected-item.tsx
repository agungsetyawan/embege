"use client";

import { Bot, RotateCcw } from "lucide-react";
import { Badge } from "@/components/reui/badge";
import { FrameFooter, FrameHeader, FramePanel } from "@/components/reui/frame";
import { SubmitButton } from "@/components/ui/submit-button";
import { restoreItem } from "./actions";

export type RejectedItemData = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  media: string;
  published_at: string | null;
  llm_summary: string | null;
  llm_reject_reason: string | null;
};

export function RejectedItem({ item }: { item: RejectedItemData }) {
  const date = item.published_at ? item.published_at.slice(0, 10) : null;
  return (
    <FramePanel>
      <FrameHeader className="gap-1.5 p-0">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="secondary">{item.media}</Badge>
            {date && <span>{date}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline">
              <Bot />
              {item.llm_reject_reason?.startsWith("Duplikat")
                ? "Duplikat otomatis"
                : "Ditolak otomatis"}
            </Badge>
          </div>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="text-[15px] font-medium leading-snug underline underline-offset-4"
        >
          {item.title}
        </a>
      </FrameHeader>
      {item.llm_reject_reason && (
        <p className="text-sm text-muted-foreground">
          {item.llm_reject_reason}
        </p>
      )}
      <FrameFooter className="flex-row justify-end gap-2 p-0">
        <form action={restoreItem}>
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
