"use client";

import { useState } from "react";
import { applySchedules } from "./actions";

export function ApplyButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            const res = await applySchedules();
            setMessage(res.message);
            setBusy(false);
          }}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Menerapkan…" : "Terapkan jadwal ke cron"}
        </button>
      </div>
      {message && <p className="text-sm text-zinc-600">{message}</p>}
    </div>
  );
}
