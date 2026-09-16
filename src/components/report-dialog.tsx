"use client";

import { Flag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/use-media-query";

export const REPORT_REASONS = [
  { value: "victims", label: "Jumlah korban salah" },
  { value: "date", label: "Tanggal kejadian salah" },
  { value: "location", label: "Lokasi atau daerah salah" },
  { value: "duplicate", label: "Berita ganda" },
  { value: "other", label: "Lainnya" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

type Status = "idle" | "sending" | "sent";

const initialState = {
  reason: "victims" as ReportReason,
  victims: "",
  date: "",
  note: "",
  evidence: "",
};

function ReportTrigger(props: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="outline" size="sm" {...props}>
      <Flag className="size-3.5" />
      Report
    </Button>
  );
}

function ReportFields({
  form,
  onChange,
}: {
  form: typeof initialState;
  onChange: (patch: Partial<typeof initialState>) => void;
}) {
  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Apa yang salah?</legend>
        {REPORT_REASONS.map((r) => (
          <label
            key={r.value}
            className="flex items-center gap-2 text-sm font-normal"
          >
            <input
              type="radio"
              name="reason"
              value={r.value}
              checked={form.reason === r.value}
              onChange={() => onChange({ reason: r.value })}
              className="accent-primary"
            />
            {r.label}
          </label>
        ))}
      </fieldset>
      {form.reason === "victims" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-victims">Jumlah korban yang benar</Label>
          <Input
            id="report-victims"
            name="reportedVictims"
            type="number"
            min={0}
            required
            value={form.victims}
            onChange={(e) => onChange({ victims: e.target.value })}
          />
        </div>
      )}
      {form.reason === "date" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="report-date">Tanggal yang benar</Label>
          <Input
            id="report-date"
            name="reportedDate"
            type="date"
            required
            value={form.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-note">
          Catatan{" "}
          <span className="font-normal text-muted-foreground">(opsional)</span>
        </Label>
        <Textarea
          id="report-note"
          name="note"
          rows={3}
          maxLength={1000}
          value={form.note}
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-evidence">
          Tautan bukti{" "}
          <span className="font-normal text-muted-foreground">(opsional)</span>
        </Label>
        <Input
          id="report-evidence"
          name="evidenceUrl"
          type="url"
          placeholder="https://"
          value={form.evidence}
          onChange={(e) => onChange({ evidence: e.target.value })}
        />
      </div>
      {/* Honeypot: hidden from humans, bots fill it and get a fake 201. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
    </>
  );
}

export function ReportDialog({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  function reset() {
    setForm(initialState);
    setStatus("idle");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          reason: form.reason,
          reported_victims: data.get("reportedVictims"),
          reported_date: data.get("reportedDate"),
          note: data.get("note"),
          evidence_url: data.get("evidenceUrl"),
          website: data.get("website"),
        }),
      });
      if (res.status === 201) {
        setStatus("sent");
        return;
      }
      if (res.status === 429) {
        setError("Kamu sudah melaporkan kasus ini baru-baru ini.");
      } else {
        setError("Laporan gagal dikirim. Coba lagi.");
      }
      setStatus("idle");
    } catch {
      setError("Laporan gagal dikirim. Coba lagi.");
      setStatus("idle");
    }
  }

  const update = (patch: Partial<typeof initialState>) =>
    setForm((f) => ({ ...f, ...patch }));

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection={isDesktop ? "right" : "down"}
      showSwipeHandle={!isDesktop}
    >
      <DrawerTrigger render={<ReportTrigger />} />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Laporkan kesalahan</DrawerTitle>
          <DrawerDescription>
            Bantu perbaiki data kasus ini. Laporanmu akan ditinjau kurator
            sebelum diterapkan.
          </DrawerDescription>
        </DrawerHeader>
        {status === "sent" ? (
          <div className="flex flex-1 flex-col gap-3 px-4 py-2">
            <p className="text-sm">
              Terima kasih. Laporanmu sudah kami terima dan akan ditinjau.
            </p>
            <DrawerFooter className="px-0">
              <DrawerClose render={<Button variant="outline" />}>
                Tutup
              </DrawerClose>
            </DrawerFooter>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col gap-3 px-4 py-2"
          >
            <ReportFields form={form} onChange={update} />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DrawerFooter className="px-0">
              <Button
                type="submit"
                disabled={status === "sending"}
                aria-busy={status === "sending"}
              >
                Kirim
                {status === "sending" && <Spinner />}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  );
}
