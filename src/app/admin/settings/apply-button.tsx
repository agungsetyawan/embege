"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { applySchedules } from "./actions";

export function ApplyButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            const res = await applySchedules();
            setMessage(res.message);
            setBusy(false);
          }}
        >
          {busy ? "Menerapkan…" : "Terapkan jadwal ke cron"}
        </Button>
      </div>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
