"use client";

import { type RegionOption, RegionPicker } from "@/components/region-picker";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { updateCase } from "./actions";
import type { CaseRow } from "./cases-table";

export function EditCaseDialog({
  row,
  regions,
  onClose,
}: {
  row: CaseRow;
  regions: RegionOption[];
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ubah kasus</DialogTitle>
        </DialogHeader>
        <form
          action={updateCase}
          onSubmit={onClose}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="caseId" value={row.id} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-region-${row.id}`}>Kabupaten/Kota</Label>
            <RegionPicker
              regions={regions}
              id={`edit-region-${row.id}`}
              defaultValue={row.region_id}
              display="leaf"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={`edit-date-${row.id}`}>Tanggal kejadian</Label>
              <DateField
                id={`edit-date-${row.id}`}
                name="occurredOn"
                defaultValue={row.occurred_on ?? undefined}
              />
            </div>
            <div className="flex w-full flex-col gap-1.5 sm:w-32">
              <Label htmlFor={`edit-victims-${row.id}`}>Korban</Label>
              <Input
                id={`edit-victims-${row.id}`}
                name="victims"
                type="number"
                min={0}
                max={9999}
                defaultValue={row.victims ?? undefined}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={`edit-school-${row.id}`}>Sekolah</Label>
              <Textarea
                id={`edit-school-${row.id}`}
                name="school"
                rows={2}
                maxLength={500}
                autoComplete="off"
                defaultValue={row.school ?? undefined}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={`edit-sppg-${row.id}`}>SPPG/dapur</Label>
              <Textarea
                id={`edit-sppg-${row.id}`}
                name="sppg"
                rows={2}
                maxLength={500}
                autoComplete="off"
                defaultValue={row.sppg ?? undefined}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-summary-${row.id}`}>Ringkasan</Label>
            <Textarea
              id={`edit-summary-${row.id}`}
              name="summary"
              required
              rows={3}
              defaultValue={row.summary}
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={`edit-media-${row.id}`}>Media sumber</Label>
              <Input
                id={`edit-media-${row.id}`}
                name="sourceMedia"
                required
                defaultValue={row.source_media}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={`edit-url-${row.id}`}>URL sumber</Label>
              <Input
                id={`edit-url-${row.id}`}
                name="sourceUrl"
                type="url"
                required
                defaultValue={row.source_url}
              />
            </div>
          </div>
          <label
            htmlFor={`edit-published-${row.id}`}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <input
              id={`edit-published-${row.id}`}
              name="published"
              type="checkbox"
              defaultChecked={row.published}
              className="size-4 shrink-0 accent-primary"
            />
            Terbitkan ke publik
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <SubmitButton size="sm" type="submit">
              Simpan
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
