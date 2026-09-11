"use client";

import { MapPin, Sparkles, TriangleAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RegionCombobox,
  type RegionOption,
} from "@/components/ui/region-combobox";
import { FormSubmitButton } from "@/components/ui/submit-button";
import { approveItem, rejectItem } from "./actions";

export type PendingItemData = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  media: string;
  published_at: string | null;
  guessed_region_id: string | null;
  llm_summary: string | null;
  llm_victims: number | null;
  geo_confidence: number | null;
};

export function PendingItem({
  item,
  regions,
}: {
  item: PendingItemData;
  regions: RegionOption[];
}) {
  const guessed = regions.find((r) => r.id === item.guessed_region_id);
  const dateDefault = item.published_at ? item.published_at.slice(0, 10) : "";

  return (
    <Card>
      <CardHeader className="gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary">{item.media}</Badge>
          {item.published_at && <span>{dateDefault}</span>}
          {guessed && (
            <Badge variant="outline">
              <MapPin />
              {guessed.district}, {guessed.province}
              {item.geo_confidence !== null &&
                ` · ${Math.round(item.geo_confidence * 100)}%`}
            </Badge>
          )}
          {item.llm_summary && (
            <Badge>
              <Sparkles />
              Ringkasan otomatis
            </Badge>
          )}
          {item.llm_victims !== null && (
            <Badge variant="outline">
              <Users />
              {item.llm_victims} korban otomatis
            </Badge>
          )}
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
        <form
          id={`approve-${item.id}`}
          action={approveItem}
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="itemId" value={item.id} />
          <div className="flex flex-col gap-1.5">
            <Label>Kabupaten/Kota</Label>
            <RegionCombobox
              regions={regions}
              defaultValue={item.guessed_region_id}
              name="regionId"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={`date-${item.id}`}>Tanggal kejadian</Label>
              <DateField
                id={`date-${item.id}`}
                name="occurredOn"
                defaultValue={dateDefault || undefined}
              />
            </div>
            <div className="flex w-32 flex-col gap-1.5">
              <Label htmlFor={`victims-${item.id}`}>Korban</Label>
              <Input
                id={`victims-${item.id}`}
                name="victims"
                type="number"
                min={0}
                defaultValue={item.llm_victims ?? undefined}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`summary-${item.id}`}>Ringkasan kurasi</Label>
            <Textarea
              id={`summary-${item.id}`}
              name="summary"
              required
              rows={2}
              defaultValue={item.llm_summary ?? item.summary ?? ""}
            />
          </div>
        </form>
        <form id={`reject-${item.id}`} action={rejectItem}>
          <input type="hidden" name="itemId" value={item.id} />
        </form>
        {guessed && !guessed.centroid_ok && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <TriangleAlert className="size-3.5 shrink-0 text-amber-500" />
            Koordinat perlu cek manual.
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <FormSubmitButton
          variant="outline"
          formId={`reject-${item.id}`}
          action={rejectItem}
        >
          Tolak
        </FormSubmitButton>
        <FormSubmitButton formId={`approve-${item.id}`} action={approveItem}>
          Setuju
        </FormSubmitButton>
      </CardFooter>
    </Card>
  );
}
