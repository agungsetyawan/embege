"use client";

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import type { FeatureCollection } from "geojson";
import { Ambulance, Users } from "lucide-react";
import { Badge } from "../reui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "../ui/drawer";
import { CaseList } from "./case-list";
import { RegionPreview } from "./region-preview";
import { ShareButton } from "./share-button";
import type { SummaryRow } from "./types";

export function RegionDetailDrawer({
  selected,
  highlightDate,
  geo,
  isDesktop,
  container,
  onClose,
}: {
  selected: SummaryRow | null;
  highlightDate: string | null;
  geo: FeatureCollection;
  isDesktop: boolean;
  container?: HTMLElement;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={selected !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      swipeDirection={isDesktop ? "right" : "down"}
      showSwipeHandle={!isDesktop}
    >
      {selected && (
        // Outer portal attaches to the map card: the built-in inner portal of
        // DrawerContent follows it so the drawer stays visible in fullscreen.
        <DrawerPrimitive.Portal container={container}>
          <DrawerContent className="w-full sm:max-w-md">
            <DrawerHeader className="pb-4 shadow-sm">
              <div className="flex items-start gap-2">
                <DrawerTitle className="min-w-0 flex-1">
                  {selected.district}, {selected.province}
                </DrawerTitle>
                <ShareButton
                  iconOnly
                  variant="ghost"
                  regionId={selected.region_id}
                  title={`Kasus keracunan di ${selected.district}, ${selected.province}`}
                  label={`Bagikan daerah ${selected.district}`}
                />
              </div>
              {selected.count > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                  <Badge variant="destructive-light">
                    <Ambulance />
                    {selected.count.toLocaleString("id-ID")} kasus
                  </Badge>
                  <Badge variant="secondary">
                    <Users />
                    {selected.victims.toLocaleString("id-ID")} korban
                  </Badge>
                </div>
              )}
            </DrawerHeader>
            <div className="min-h-0 overflow-y-auto px-4 py-4">
              <div className="mb-4 overflow-hidden rounded-lg border">
                <RegionPreview selected={selected} geo={geo} />
              </div>
              <CaseList
                regionId={selected.region_id}
                highlightDate={highlightDate}
              />
            </div>
          </DrawerContent>
        </DrawerPrimitive.Portal>
      )}
    </Drawer>
  );
}
