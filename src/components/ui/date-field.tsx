"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { Calendar } from "./calendar";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(s: string | null | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// Pilihan tanggal berbahasa Indonesia. Nilai ISO disalurkan ke Server Action
// lewat input hidden. Kosong berarti tanggal tidak diketahui.
export function DateField({
  defaultValue,
  name,
  id,
}: {
  defaultValue?: string;
  name: string;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(
    parseISODate(defaultValue),
  );

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={date ? toISODate(date) : ""} />
      <PopoverPrimitive.Trigger asChild>
        <Button
          id={id}
          variant="outline"
          type="button"
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon data-icon="inline-start" />
          {date ? (
            format(date, "d MMMM yyyy", { locale: localeId })
          ) : (
            <span className="text-muted-foreground">Pilih tanggal</span>
          )}
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Content
        align="start"
        sideOffset={4}
        className="z-50 rounded-md border bg-card p-0 text-card-foreground shadow-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <Calendar
          mode="single"
          selected={date}
          disabled={{ after: new Date() }}
          onSelect={(d: Date | undefined) => {
            setDate(d);
            setOpen(false);
          }}
        />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );
}
