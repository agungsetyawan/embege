"use client";

import { Check, MapPin, Sparkles, TriangleAlert, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RegionCombobox,
  type RegionOption,
} from "@/components/ui/region-combobox";
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
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{item.media}</Badge>
          {item.published_at && <span>{dateDefault}</span>}
          {guessed && (
            <Badge variant="outline">
              <MapPin />
              Lokasi: {guessed.district}, {guessed.province}
              {!guessed.centroid_ok && " (perlu cek koordinat)"}
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
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline underline-offset-4"
        >
          {item.title}
        </a>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form action={approveItem} className="flex flex-col gap-3">
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
              <Input
                id={`date-${item.id}`}
                name="occurredOn"
                type="date"
                defaultValue={dateDefault}
              />
            </div>
            <div className="flex w-32 flex-col gap-1.5">
              <Label htmlFor={`victims-${item.id}`}>Korban</Label>
              <Input
                id={`victims-${item.id}`}
                name="victims"
                type="number"
                min={0}
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
          <div>
            <Button type="submit">
              <Check data-icon="inline-start" />
              Setujui sebagai kasus
            </Button>
          </div>
        </form>
        <form action={rejectItem}>
          <input type="hidden" name="itemId" value={item.id} />
          <Button type="submit" variant="outline">
            <X data-icon="inline-start" />
            Tolak
          </Button>
        </form>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <TriangleAlert className="size-3.5 shrink-0 text-amber-500" />
          Daerah bertanda butuh verifikasi koordinat manual.
        </p>
      </CardContent>
    </Card>
  );
}
