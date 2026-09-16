"use client";

import dynamic from "next/dynamic";
import { IndonesiaMapSkeleton } from "@/components/indonesia-map-skeleton";

const IndonesiaMap = dynamic(
  () => import("@/components/indonesia-map").then((m) => m.IndonesiaMap),
  {
    ssr: false,
    loading: () => <IndonesiaMapSkeleton />,
  },
);

export function IndonesiaMapLazy() {
  return <IndonesiaMap />;
}
