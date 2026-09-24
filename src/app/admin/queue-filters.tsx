"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NavLinkStatus } from "@/components/ui/nav-link-status";
import type { RegionOption } from "./pending-item";

// Same native-select styling as /admin/cases (duplicated: that constant
// lives in a server file, so it cannot be imported here).
const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring disabled:opacity-50 dark:bg-input/30";

export type QueueTab = "pending" | "rejected" | "reports" | "deleted";

// Single search box across all queue columns + wilayah filter. Search is
// debounced into ?q= via router.replace (no history spam); the server
// re-renders the list underneath while the input keeps focus.
export function QueueFilters({
  initialQ,
  initialRegionId,
  tab,
  regions,
}: {
  initialQ: string;
  initialRegionId: string;
  tab: QueueTab;
  regions: RegionOption[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [region, setRegion] = useState(initialRegionId);

  const buildHref = useCallback(
    (nextQ: string, nextRegion: string) => {
      const params = new URLSearchParams();
      if (tab !== "pending") params.set("tab", tab);
      if (nextQ) params.set("q", nextQ);
      if (nextRegion) params.set("regionId", nextRegion);
      const s = params.toString();
      return `/admin${s ? `?${s}` : ""}`;
    },
    [tab],
  );

  // Adopt externally navigated values (back/forward); our own replace
  // re-renders with identical values, so typing is never clobbered.
  useEffect(() => {
    setQ(initialQ);
    setRegion(initialRegionId);
  }, [initialQ, initialRegionId]);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed === initialQ && region === initialRegionId) return;
    const t = setTimeout(() => {
      router.replace(buildHref(trimmed, region));
    }, 400);
    return () => clearTimeout(t);
  }, [q, region, initialQ, initialRegionId, buildHref, router]);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_200px_auto]">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="queue-q">Cari</Label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="queue-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            placeholder="Judul, ringkasan, media, URL..."
            className="pl-8"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="queue-region">Wilayah</Label>
        <select
          id="queue-region"
          value={region}
          onChange={(e) => {
            const next = e.target.value;
            setRegion(next);
            router.replace(buildHref(q.trim(), next));
          }}
          className={selectClass}
        >
          <option value="">Semua</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.district ? `${r.district}, ` : ""}
              {r.province}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <Button
          type="button"
          variant="outline"
          nativeButton={false}
          render={<Link href={buildHref("", "")} />}
        >
          Reset
          <NavLinkStatus />
        </Button>
      </div>
    </div>
  );
}
