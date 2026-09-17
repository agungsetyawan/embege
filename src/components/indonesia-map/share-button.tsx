"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { isDateString } from "@/lib/validate";
import { Button } from "../ui/button";

export function buildShareUrl(regionId: string, date?: string | null): string {
  const query = new URLSearchParams({ region_id: regionId });
  const day = date?.slice(0, 10) ?? "";
  if (isDateString(day)) query.set("date", day);
  // Origin, not an env var: follows whatever domain serves the page.
  return `${window.location.origin}/?${query.toString()}`;
}

export function ShareButton({
  regionId,
  date,
  title,
  label,
  iconOnly,
  className,
  variant = "outline",
}: {
  regionId: string;
  date?: string | null;
  title: string;
  label: string;
  iconOnly?: boolean;
  className?: string;
  variant?: "outline" | "ghost";
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const stateText = {
    idle: "Share",
    copied: "Copied",
    failed: "Failed",
  }[state];

  const flash = (next: "copied" | "failed") => {
    setState(next);
    setTimeout(() => setState("idle"), 2000);
  };

  const handleShare = async () => {
    const url = buildShareUrl(regionId, date);
    // System sheet first (mobile); clipboard fallback otherwise.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        // Dismissed by the user: stay silent, do not fall through to copy.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash("copied");
    } catch {
      flash("failed");
    }
  };

  return (
    <Button
      variant={variant}
      size={iconOnly ? "icon-sm" : "sm"}
      onClick={() => void handleShare()}
      aria-label={label}
      className={className}
    >
      {state === "copied" ? (
        <Check className="size-3.5" />
      ) : (
        <Share2 className="size-3.5" />
      )}
      {!iconOnly && stateText}
    </Button>
  );
}
