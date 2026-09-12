"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const IndoMap = dynamic(
  () => import("@/components/indo-map").then((m) => m.IndoMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[70vh] w-full" />,
  },
);

export function IndoMapLazy() {
  return <IndoMap />;
}
