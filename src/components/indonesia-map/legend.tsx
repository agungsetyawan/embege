"use client";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";

// Gradient scale without a permanent caption: hover reveals the explanation
// on desktop, tap toggles it on touch. Same pattern as MapAttributionControl.
export function MapLegend({ maxCount }: { maxCount: number }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    L.DomEvent.disableClickPropagation(node);
    L.DomEvent.disableScrollPropagation(node);
  }, []);
  return (
    <div ref={boxRef} className="group relative">
      <div
        role="note"
        className={`absolute bottom-full left-0 mb-1.5 w-44 rounded-md border bg-popover px-2.5 py-1.5 text-[11px] leading-relaxed text-popover-foreground shadow-md transition-opacity ${
          open
            ? "visible opacity-100"
            : "invisible opacity-0 group-hover:visible group-hover:opacity-100"
        }`}
      >
        Warna menunjukkan jumlah kasus: kuning sedikit, merah banyak.
      </div>
      <button
        type="button"
        aria-label="Keterangan warna peta"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-center gap-1 rounded-md border bg-popover px-2 py-2 text-[10px] leading-relaxed text-muted-foreground shadow-md"
      >
        <span className="tabular-nums">{maxCount.toLocaleString("id-ID")}</span>
        <span
          aria-hidden="true"
          className="inline-block h-20 w-2 rounded-full bg-[linear-gradient(180deg,#dc2626,#f97316,#eab308)]"
        />
        <span className="tabular-nums">1</span>
      </button>
    </div>
  );
}
