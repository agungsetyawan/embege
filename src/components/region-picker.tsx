"use client";

import { TriangleAlert } from "lucide-react";
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
import type {
  CascaderNode,
  CascaderValueDisplay,
} from "@/components/reui/cascader/cascader-types";
import { Button } from "@/components/ui/button";

export type RegionOption = {
  id: string;
  province: string;
  district: string;
  centroid_ok: boolean;
};

// Two-level Cascader tree: one node per province, rows as its leaves.
export function groupByProvince<T extends { province: string }, D>(
  rows: T[],
  toLeaf: (row: T) => CascaderNode<D>,
): CascaderNode<D>[] {
  const byProvince = new Map<string, CascaderNode<D>>();
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
    province.children?.push(toLeaf(r));
  }
  return [...byProvince.values()];
}

type RegionNode = CascaderNode<{ centroidOk: boolean }>;

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

// Admin region field: submits the picked region id as `regionId`.
export function RegionPicker({
  regions,
  id,
  defaultValue,
  display,
}: {
  regions: RegionOption[];
  id: string;
  defaultValue?: string;
  display?: CascaderValueDisplay;
}) {
  const tree = groupByProvince(regions, (r) => ({
    value: r.id,
    label: r.district ? `${r.district}, ${r.province}` : r.province,
    keywords: [r.district, r.province],
    data: { centroidOk: r.centroid_ok },
  }));

  return (
    <Cascader
      items={tree}
      name="regionId"
      id={id}
      defaultValue={defaultValue}
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
        <CascaderValue placeholder="Pilih kabupaten/kota" display={display} />
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
  );
}
