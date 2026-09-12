"use client";

import { MapPin } from "lucide-react";
import { Badge } from "@/components/reui/badge";
import { FrameFooter, FrameHeader, FramePanel } from "@/components/reui/frame";
import { FormSubmitButton } from "@/components/ui/submit-button";
import { restoreCase } from "./actions";

export type DeletedItemData = {
  id: string;
  summary: string;
  victims: number | null;
  occurred_on: string | null;
  source_media: string;
  source_url: string;
  deleted_at: string;
  region: { province: string; district: string };
};

export function DeletedItem({ item }: { item: DeletedItemData }) {
  return (
    <FramePanel>
      <FrameHeader className="gap-1.5 p-0">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline">
            <MapPin />
            {item.region.district}, {item.region.province}
          </Badge>
          <span>Dihapus {item.deleted_at.slice(0, 10)}</span>
        </div>
        <p className="text-[15px] leading-snug">{item.summary}</p>
        <a
          href={item.source_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-muted-foreground underline underline-offset-4"
        >
          Sumber: {item.source_media}
        </a>
      </FrameHeader>
      <div className="flex flex-col py-4">
        <form id={`restore-${item.id}`} action={restoreCase}>
          <input type="hidden" name="caseId" value={item.id} />
        </form>
      </div>
      <FrameFooter className="flex-row justify-end gap-2 p-0">
        <FormSubmitButton
          variant="outline"
          formId={`restore-${item.id}`}
          action={restoreCase}
        >
          Pulihkan
        </FormSubmitButton>
      </FrameFooter>
    </FramePanel>
  );
}
