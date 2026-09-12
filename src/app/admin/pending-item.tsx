"use client";

import { MapPin, Sparkles, TriangleAlert, Users } from "lucide-react";
import { Alert, AlertTitle } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import {
  Cascader,
  CascaderContent,
  CascaderEmpty,
  CascaderList,
  CascaderPanel,
  CascaderStatus,
  CascaderTrigger,
} from "@/components/reui/cascader/cascader";
import { CascaderItems } from "@/components/reui/cascader/cascader-item";
import {
  CascaderBreadcrumb,
  CascaderInput,
  CascaderNav,
  CascaderValue,
} from "@/components/reui/cascader/cascader-nav";
import type { CascaderNode } from "@/components/reui/cascader/cascader-types";
import { FrameFooter, FrameHeader, FramePanel } from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { approveItem, rejectItem } from "./actions";

export type RegionOption = {
  id: string;
  province: string;
  district: string;
  centroid_ok: boolean;
};

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

type RegionNode = CascaderNode<{ centroidOk: boolean }>;

function buildRegionTree(regions: RegionOption[]): RegionNode[] {
  const byProvince = new Map<string, RegionNode>();
  for (const r of regions) {
    let province = byProvince.get(r.province);
    if (!province) {
      province = {
        value: `prov:${r.province}`,
        label: r.province,
        children: [],
      };
      byProvince.set(r.province, province);
    }
    province.children?.push({
      value: r.id,
      label: r.district ? `${r.district}, ${r.province}` : r.province,
      keywords: [r.district, r.province],
      data: { centroidOk: r.centroid_ok },
    });
  }
  return [...byProvince.values()];
}

function renderRegionLabel(node: RegionNode) {
  if (node.data && !node.data.centroidOk) {
    return (
      <span className="flex items-center gap-1">
        {node.label}
        <TriangleAlert className="size-3.5 shrink-0 text-amber-500" />
      </span>
    );
  }
  return node.label;
}

export function PendingItem({
  item,
  regions,
}: {
  item: PendingItemData;
  regions: RegionOption[];
}) {
  const guessed = regions.find((r) => r.id === item.guessed_region_id);
  const dateDefault = item.published_at ? item.published_at.slice(0, 10) : "";
  const tree = buildRegionTree(regions);

  return (
    <FramePanel>
      <FrameHeader className="gap-1.5 p-0">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="secondary">{item.media}</Badge>
            {item.published_at && <span>{dateDefault}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {item.llm_summary && (
              <Badge>
                <Sparkles />
                Ringkasan otomatis
              </Badge>
            )}
            {guessed && (
              <Badge variant="outline">
                <MapPin />
                {guessed.district}, {guessed.province}
                {item.geo_confidence !== null &&
                  ` · ${Math.round(item.geo_confidence * 100)}%`}
              </Badge>
            )}
            {item.llm_victims !== null && (
              <Badge variant="outline">
                <Users />
                {item.llm_victims} korban
              </Badge>
            )}
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
      <div className="flex flex-col py-4">
        <form
          id={`approve-${item.id}`}
          action={approveItem}
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="itemId" value={item.id} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`region-${item.id}`}>Kabupaten/Kota</Label>
            <Cascader
              items={tree}
              name="regionId"
              id={`region-${item.id}`}
              defaultValue={item.guessed_region_id ?? undefined}
              searchScope="deep"
              renderLabel={renderRegionLabel}
              labels={{
                search: (parent) =>
                  parent ? `Cari di ${parent}...` : "Ketik nama daerah",
                back: "Kembali",
                empty: "Tidak ada daerah yang cocok.",
                keyboardHint: () =>
                  "Gunakan panah Kanan untuk membuka cabang dan panah Kiri untuk kembali.",
              }}
            >
              <CascaderTrigger
                render={
                  <Button
                    variant="outline"
                    type="button"
                    className="w-full justify-between font-normal"
                  />
                }
              >
                <CascaderValue placeholder="Pilih kabupaten/kota" />
              </CascaderTrigger>
              <CascaderContent>
                <CascaderPanel>
                  <CascaderNav>
                    <CascaderBreadcrumb />
                    <CascaderInput />
                  </CascaderNav>
                  <CascaderEmpty />
                  <CascaderList maxHeight={288}>
                    <CascaderItems />
                  </CascaderList>
                  <CascaderStatus />
                </CascaderPanel>
              </CascaderContent>
            </Cascader>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={`date-${item.id}`}>Tanggal kejadian</Label>
              <DateField
                id={`date-${item.id}`}
                name="occurredOn"
                defaultValue={dateDefault || undefined}
              />
            </div>
            <div className="flex w-full flex-col gap-1.5 sm:w-32">
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
              rows={3}
              defaultValue={item.llm_summary ?? item.summary ?? ""}
            />
          </div>
        </form>
        <form id={`reject-${item.id}`} action={rejectItem}>
          <input type="hidden" name="itemId" value={item.id} />
        </form>
        {guessed && !guessed.centroid_ok && (
          <Alert variant="warning">
            <TriangleAlert />
            <AlertTitle>Koordinat perlu cek manual.</AlertTitle>
          </Alert>
        )}
      </div>
      <FrameFooter className="flex-row justify-end gap-2 p-0">
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
      </FrameFooter>
    </FramePanel>
  );
}
