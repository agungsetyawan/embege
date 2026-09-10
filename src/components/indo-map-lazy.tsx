"use client";

import dynamic from "next/dynamic";

const IndoMap = dynamic(
  () => import("@/components/indo-map").then((m) => m.IndoMap),
  {
    ssr: false,
    loading: () => <p className="p-8 text-center">Memuat peta…</p>,
  },
);

export function IndoMapLazy() {
  return <IndoMap />;
}
