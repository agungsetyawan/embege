"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../reui/badge";
import {
  Cascader,
  CascaderContent,
  CascaderEmpty,
  CascaderList,
  CascaderPanel,
  CascaderStatus,
  CascaderTrigger,
} from "../reui/cascader/cascader";
import { CascaderItems } from "../reui/cascader/cascader-item";
import {
  CascaderBreadcrumb,
  CascaderInput,
  CascaderNav,
} from "../reui/cascader/cascader-nav";
import type { CascaderNode } from "../reui/cascader/cascader-types";
import type { SummaryRow } from "./types";

// Grouped by province (ReUI Cascader), searchable deep. Same setSelected
// path as a marker click, plus a zoom-in flight.
type RegionSearchNode = CascaderNode<{ count: number }>;

function buildRegionSearchTree(rows: SummaryRow[]): RegionSearchNode[] {
  const byProvince = new Map<string, RegionSearchNode>();
  for (const r of rows) {
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
      value: r.region_id,
      label: r.district ?? r.province,
      keywords: [r.district, r.province],
      data: { count: r.count },
    });
  }
  return [...byProvince.values()];
}

export function RegionSearch({
  rows,
  container,
  onSelect,
}: {
  rows: SummaryRow[];
  container?: HTMLElement;
  onSelect: (s: SummaryRow) => void;
}) {
  const [cascaderKey, setCascaderKey] = useState(0);
  const tree = useMemo(() => buildRegionSearchTree(rows), [rows]);

  return (
    <Cascader
      key={cascaderKey}
      items={tree}
      searchScope="deep"
      indicator={false}
      onValueChange={(value) => {
        const row = rows.find((r) => r.region_id === value);
        if (row) onSelect(row);
      }}
      onOpenChange={(open) => {
        // Reset query and path so the next open starts clean.
        if (!open) setCascaderKey((k) => k + 1);
      }}
      renderLabel={(node) => {
        const count = (node.data as { count?: number } | undefined)?.count;
        if (count == null || count === 0) return node.label;
        return (
          <span className="flex w-full items-center justify-between gap-2">
            <span className="truncate">{node.label}</span>
            <Badge variant="destructive-light" size="sm" className="shrink-0">
              {count.toLocaleString("id-ID")} kasus
            </Badge>
          </span>
        );
      }}
      labels={{
        search: (parent) =>
          parent ? `Cari di ${parent}...` : "Cari kabupaten/kota...",
        empty: "Tidak ada daerah yang cocok.",
        back: "Kembali",
      }}
    >
      {/* h-[41px] mirrors the panel header: nav py-1 (8) + input row h-8 (32) + border-b (1). */}
      <CascaderTrigger
        showIcon={false}
        aria-label="Cari kabupaten/kota"
        className="absolute top-3 left-3 z-1000 flex h-[41px] w-64 max-w-[calc(100%-4.5rem)] items-center gap-2 rounded-lg bg-popover px-3 text-muted-foreground shadow-md ring-1 ring-foreground/10 transition-opacity md:w-80 aria-expanded:pointer-events-none aria-expanded:opacity-0"
        render={<button type="button" />}
      >
        <span className="min-w-0 flex-1 truncate text-start text-base">
          Cari kabupaten/kota...
        </span>
        <Search className="size-4 shrink-0" />
      </CascaderTrigger>
      <CascaderContent
        align="start"
        // -41 = bar height (h-[41px]): panel top lands on the bar's top edge
        // and grows downward while the bar fades out via aria-expanded.
        sideOffset={-41}
        container={container}
        className="w-64 shadow-md md:w-80 data-open:animate-none data-closed:animate-none"
      >
        <CascaderPanel>
          <CascaderNav>
            <CascaderBreadcrumb />
            <CascaderInput className="text-base" />
          </CascaderNav>
          <CascaderEmpty />
          <CascaderList maxHeight={288}>
            <CascaderItems />
          </CascaderList>
          <CascaderStatus />
        </CascaderPanel>
      </CascaderContent>
    </Cascader>
  );
}
