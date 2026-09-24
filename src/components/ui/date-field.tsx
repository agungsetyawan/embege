"use client";

import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

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

// Indonesian date picker. The ISO value flows to the Server Action
// via a hidden input. Empty means the date is unknown.
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
    <Popover open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={date ? toISODate(date) : ""} />
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            type="button"
            className="w-full justify-start text-left font-normal"
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        {date ? (
          format(date, "d MMMM yyyy", { locale: localeId })
        ) : (
          <span className="text-muted-foreground">Pilih tanggal</span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-auto border bg-card p-0 text-card-foreground"
      >
        <Calendar
          mode="single"
          selected={date}
          // Dropdown caption: jumping to an old year one month at a time is
          // unusable for correcting past case dates.
          captionLayout="dropdown"
          startMonth={new Date(2020, 0, 1)}
          endMonth={new Date()}
          // v10 opens on today, not on `selected`: without this an existing
          // date (e.g. Ubah case) opens the wrong month with nothing marked.
          defaultMonth={date}
          disabled={{ after: new Date() }}
          onSelect={(d: Date | undefined) => {
            setDate(d);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
