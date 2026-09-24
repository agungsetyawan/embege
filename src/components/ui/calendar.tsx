"use client";

import { id } from "date-fns/locale";
import type { ComponentProps } from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

export function Calendar({
  className,
  ...props
}: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={id}
      weekStartsOn={1}
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        months: "relative flex flex-col gap-4",
        month: "flex flex-col gap-4",
        nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
        button_previous:
          "inline-flex size-7 items-center justify-center rounded-md bg-transparent p-0 opacity-50 hover:bg-accent hover:text-accent-foreground hover:opacity-100",
        button_next:
          "inline-flex size-7 items-center justify-center rounded-md bg-transparent p-0 opacity-50 hover:bg-accent hover:text-accent-foreground hover:opacity-100",
        chevron: "size-4 fill-current",
        month_caption: "flex w-full items-center justify-center",
        caption_label: "inline-flex items-center gap-1 text-sm font-medium",
        dropdowns: "flex items-center justify-center gap-3",
        // v10 renders an aria-hidden label + chevron with the native select
        // overlaid invisible on top: style the label, not the select.
        dropdown_root: "relative inline-flex items-center",
        dropdown: "absolute inset-0 h-full w-full cursor-pointer opacity-0",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 rounded-md text-[0.8rem] font-normal text-muted-foreground",
        weeks: "flex w-full flex-col",
        week: "flex w-full",
        day: "relative p-0 text-center text-sm",
        day_button:
          "inline-flex size-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
        today: "bg-accent text-accent-foreground",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
      }}
      {...props}
    />
  );
}
