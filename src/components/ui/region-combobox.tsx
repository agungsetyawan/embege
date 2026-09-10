"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "cmdk";
import { Check, ChevronsUpDown, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export type RegionOption = {
  id: string;
  province: string;
  district: string;
  centroid_ok: boolean;
};

// Combobox searchable untuk ratusan daerah. Berdiri sendiri (client),
// nilainya disalurkan ke Server Action lewat input hidden.
export function RegionCombobox({
  regions,
  defaultValue,
  name,
}: {
  regions: RegionOption[];
  defaultValue?: string | null;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue ?? "");
  const selected = regions.find((r) => r.id === value);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      {/* required dihapus: validasi browser tidak bisa fokus ke hidden input.
          Server action menolak regionId kosong. */}
      <input type="hidden" name={name} value={value} />
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          type="button"
          className="w-full justify-between font-normal"
        >
          <span className="flex items-center gap-1 truncate">
            {selected ? (
              <>
                {selected.district}, {selected.province}
                {!selected.centroid_ok && (
                  <TriangleAlert className="size-3.5 shrink-0 text-amber-500" />
                )}
              </>
            ) : (
              "Pilih kabupaten/kota"
            )}
          </span>
          <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Content
        align="start"
        className="z-50 w-(--radix-popover-trigger-width) rounded-md border bg-card p-0 text-card-foreground data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <Command>
          <CommandInput placeholder="Ketik nama daerah" />
          <CommandList className="max-h-60 overflow-y-auto">
            <CommandEmpty>Tidak ada daerah yang cocok.</CommandEmpty>
            <CommandGroup>
              {regions.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.district} ${r.province}`}
                  onSelect={() => {
                    setValue(r.id);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <Check
                    className={cn(
                      "shrink-0",
                      value === r.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex items-center gap-1 truncate">
                    {r.district}, {r.province}
                    {!r.centroid_ok && (
                      <TriangleAlert className="size-3.5 shrink-0 text-amber-500" />
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );
}
