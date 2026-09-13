"use client";

import dynamic from "next/dynamic";
import { IndoMapSkeleton } from "@/components/indo-map-skeleton";

const IndoMap = dynamic(
  () => import("@/components/indo-map").then((m) => m.IndoMap),
  {
    ssr: false,
    loading: () => <IndoMapSkeleton />,
  },
);

export function IndoMapLazy() {
  return <IndoMap />;
}
