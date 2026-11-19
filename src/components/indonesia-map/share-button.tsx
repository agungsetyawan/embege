"use client";

import { Check, Share2, X } from "lucide-react";
import { useRef, useState } from "react";
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
    idle: "Bagikan",
    copied: "Disalin",
    failed: "Gagal",
  }[state];

  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastMessage = useRef("");

  const flash = (next: "copied" | "failed") => {
    clearTimeout(timer.current);
    setState(next);
    let text = next === "copied" ? "Tautan disalin" : "Gagal menyalin tautan";
    // VoiceOver skips a repeat of the previous message; a no-break space makes it differ.
    if (text === lastMessage.current) text += " ";
    lastMessage.current = text;
    setMessage(text);
    timer.current = setTimeout(() => {
      setState("idle");
      setMessage("");
    }, 2000);
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
    <>
      <Button
        variant={variant}
        size={iconOnly ? "icon-sm" : "sm"}
        onClick={() => void handleShare()}
        aria-label={label}
        className={className}
      >
        {state === "copied" ? (
          <Check className="size-3.5" />
        ) : state === "failed" ? (
          <X className="size-3.5" />
        ) : (
          <Share2 className="size-3.5" />
        )}
        {!iconOnly && stateText}
      </Button>
      {/* Outside the button: a live region inside a button is not reliably announced. */}
      <output className="sr-only">{message}</output>
    </>
  );
}
