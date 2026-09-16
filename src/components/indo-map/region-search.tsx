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
import { IconTile } from "../reui/icon-tile";
import type { SummaryRow } from "./types";

// Grouped by province (ReUI Cascader), searchable deep. Same setSelected
// path as a marker click, plus a zoom-in flight.
type RegionSearchNode = CascaderNode<{ count: number }>;

// -32 = IconTile sm height: panel top lands on the trigger's top edge,
// so the panel grows from the button's own top-left corner.
const SEARCH_PANEL_OFFSET = -32;

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
  onSelect,
}: {
  rows: SummaryRow[];
  onSelect: (s: SummaryRow) => void;
}) {
  const [cascaderKey, setCascaderKey] = useState(0);
  const tree = useMemo(() => buildRegionSearchTree(rows), [rows]);

  return (
    <Cascader
      key={cascaderKey}
      items={tree}
      searchScope="deep"
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
            <Badge variant="secondary" size="sm" className="shrink-0">
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
      <CascaderTrigger
        showIcon={false}
        render={
          <IconTile
            variant="outline"
            size="sm"
            className="absolute top-3 left-3 z-1001 shrink-0 shadow-md dark:bg-background aria-expanded:opacity-0 aria-expanded:pointer-events-none"
            render={<button type="button" aria-label="Cari kabupaten/kota" />}
          >
            <Search className="size-4" />
          </IconTile>
        }
      ></CascaderTrigger>
      <CascaderContent
        align="start"
        sideOffset={SEARCH_PANEL_OFFSET}
        className="w-64 shadow-sm"
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
