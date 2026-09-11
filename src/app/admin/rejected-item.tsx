"use client";

import { Bot, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
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
    <Card>
      <CardHeader className="gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary">{item.media}</Badge>
          {date && <span>{date}</span>}
          <Badge variant="outline">
            <Bot />
            Ditolak otomatis
          </Badge>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="text-[15px] font-medium leading-snug underline underline-offset-4"
        >
          {item.title}
        </a>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {item.llm_reject_reason && (
          <p className="text-sm text-muted-foreground">
            {item.llm_reject_reason}
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <form action={restoreItem}>
          <input type="hidden" name="itemId" value={item.id} />
          <SubmitButton type="submit" variant="outline">
            <RotateCcw data-icon="inline-start" />
            Kembalikan ke antrean
          </SubmitButton>
        </form>
      </CardFooter>
    </Card>
  );
}
