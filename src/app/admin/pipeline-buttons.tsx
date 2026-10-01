"use client";

import { Newspaper, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  type PipelineResult,
  triggerCrawl,
  triggerEnrich,
} from "./pipeline-actions";

// Per-button cooldown (not shared) so the crawl-then-enrich flow stays
// clickable in sequence.
const COOLDOWN_MS = 60_000;

function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (until <= Date.now()) return;
    setNow(Date.now());
    const t = setInterval(() => {
      if (Date.now() >= until) {
        clearInterval(t);
        setUntil(0);
      } else setNow(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [until]);
  return {
    remaining: Math.max(0, Math.ceil((until - now) / 1000)),
    mark: () => setUntil(Date.now() + COOLDOWN_MS),
  };
}

export function PipelineButtons() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"crawl" | "enrich" | null>(null);
  const crawlCd = useCooldown();
  const enrichCd = useCooldown();
  // Pipeline toasts only: top-center on desktop, bottom-center on mobile.
  const position = useIsMobile() ? "bottom-center" : "top-center";

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  // @reui/c-sonner-21 pattern: one loading toast updated by id on completion.
  const run = async (
    kind: "crawl" | "enrich",
    fn: () => Promise<PipelineResult>,
    mark: () => void,
  ) => {
    setOpen(false);
    setBusy(kind);
    const opts = {
      id: `pipeline-${kind}`,
      position,
      duration: 10_000,
    } as const;
    toast.loading(`Menjalankan ${kind}...`, opts);
    try {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message, opts);
        mark();
      } else {
        toast.error(res.message, opts);
      }
    } catch {
      toast.error(`Gagal: tidak bisa menjalankan ${kind}.`, opts);
    }
    setBusy(null);
  };

  const jobs = [
    {
      kind: "crawl",
      title: "Crawl",
      icon: Newspaper,
      fn: triggerCrawl,
      cd: crawlCd,
    },
    {
      kind: "enrich",
      title: "Enrich",
      icon: Sparkles,
      fn: triggerEnrich,
      cd: enrichCd,
    },
  ] as const;

  return (
    <div className="fixed right-8 bottom-20 z-40 flex flex-col items-end gap-2">
      {open && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 -z-10 cursor-default"
        />
      )}
      <div
        className="flex flex-col items-end gap-2 transition-all data-[closed]:pointer-events-none data-[closed]:translate-y-2 data-[closed]:opacity-0"
        data-closed={open ? undefined : ""}
      >
        {jobs.map(({ kind, title, icon: Icon, fn, cd }) => (
          <Button
            key={kind}
            type="button"
            variant="secondary"
            disabled={busy !== null || cd.remaining > 0}
            onClick={() => run(kind, fn, cd.mark)}
            className="rounded-full shadow-md"
          >
            {busy === kind ? <Spinner /> : <Icon />}
            {cd.remaining > 0 ? `${title} (${cd.remaining})` : title}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        aria-expanded={open}
        aria-label={
          open ? "Tutup menu crawl dan enrich" : "Buka menu crawl dan enrich"
        }
        onClick={() => setOpen((v) => !v)}
        className="size-12 rounded-full shadow-lg"
      >
        <Plus
          className={`size-5 transition-transform ${open ? "rotate-45" : ""}`}
        />
      </Button>
    </div>
  );
}
