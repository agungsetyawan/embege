"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// Bar tipis di atas layar selama navigasi antar halaman.
// Nyalakan saat link internal diklik, matikan saat rute baru tampil.
function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href^="/"]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target || anchor.hasAttribute("download")) return;
      // Klik ke URL yang sama tidak memicu navigasi, abaikan.
      const to = anchor.getAttribute("href")?.split("#")[0];
      if (to === window.location.pathname + window.location.search) return;
      setNavigating(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: sengaja jalan ulang tiap rute ganti
  useEffect(() => {
    setNavigating(false);
  }, [pathname, searchParams]);

  // Pengaman: bar tidak boleh nyangkut lebih dari 4 detik.
  useEffect(() => {
    if (!navigating) return;
    const t = setTimeout(() => setNavigating(false), 4000);
    return () => clearTimeout(t);
  }, [navigating]);

  if (!navigating) return null;
  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-0.5">
      <div className="h-full w-full animate-pulse bg-primary" />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBar />
    </Suspense>
  );
}
