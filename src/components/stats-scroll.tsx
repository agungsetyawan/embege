"use client";

import { useEffect, useRef, useState } from "react";

type Edge = "start" | "middle" | "end" | "none";

// Fades the scrollable edge(s) of the stats strip. The fade on a side
// disappears once that side reaches its scroll end.
export function StatsScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<Edge>("start");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      if (el.scrollWidth <= el.clientWidth + 1) {
        setEdge("none");
      } else if (el.scrollLeft <= 0) {
        setEdge("start");
      } else if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
        setEdge("end");
      } else {
        setEdge("middle");
      }
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const showLeft = edge === "middle" || edge === "end";
  const showRight = edge === "start" || edge === "middle";

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex gap-2 overflow-x-auto px-4 pb-1 scroll-px-4 snap-x snap-mandatory lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/10 to-transparent transition-opacity duration-300 motion-reduce:transition-none dark:from-background ${showLeft ? "opacity-100" : "opacity-0"}`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/10 to-transparent transition-opacity duration-300 motion-reduce:transition-none dark:from-background ${showRight ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
