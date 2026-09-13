"use client";

import { useLinkStatus } from "next/link";
import { Spinner } from "./spinner";

// Spinner kecil yang muncul di dalam Link selama navigasi berlangsung.
// Ditaruh sebagai anak Button render Link di navigasi admin dan pagination.
export function NavLinkStatus() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Spinner />;
}
