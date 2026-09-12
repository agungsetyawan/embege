"use client";

import { Flag, MapPin, Trash2, Users } from "lucide-react";
import { REPORT_REASONS } from "@/components/report-dialog";
import { Badge } from "@/components/reui/badge";
import {
  Cascader,
  CascaderContent,
  CascaderEmpty,
  CascaderList,
  CascaderPanel,
  CascaderStatus,
  CascaderTrigger,
} from "@/components/reui/cascader/cascader";
import { CascaderItems } from "@/components/reui/cascader/cascader-item";
import {
  CascaderBreadcrumb,
  CascaderInput,
  CascaderNav,
  CascaderValue,
} from "@/components/reui/cascader/cascader-nav";
import { FrameFooter, FrameHeader, FramePanel } from "@/components/reui/frame";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSubmitButton } from "@/components/ui/submit-button";
import {
  applyReportFix,
  deleteReportedCase,
  dismissReport,
  moveReportCase,
  resolveReport,
} from "./actions";
import {
  buildRegionTree,
  type RegionOption,
  renderRegionLabel,
} from "./pending-item";

export type ReportItemData = {
  id: string;
  reason: string;
  reported_victims: number | null;
  reported_date: string | null;
  note: string | null;
  evidence_url: string | null;
  created_at: string;
  case: {
    id: string;
    region_id: string;
    summary: string;
    victims: number | null;
    occurred_on: string | null;
    source_url: string;
    region: { province: string; district: string };
  };
};

export type CaseTwin = {
  id: string;
  summary: string;
  victims: number | null;
  occurred_on: string | null;
  source_media: string;
  source_url: string;
};

function shortDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "-";
}

function TwinList({ twins }: { twins: CaseTwin[] }) {
  if (twins.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Tidak ada kembaran yang cocok di database.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {twins.map((twin) => (
        <div
          key={twin.id}
          className="flex flex-col gap-1 rounded-lg border p-3"
        >
          <div className="text-xs text-muted-foreground">
            {twin.source_media} · {shortDate(twin.occurred_on)} ·{" "}
            {twin.victims ?? "-"} korban
          </div>
          <p className="text-sm leading-snug">{twin.summary}</p>
          <a
            href={twin.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium underline underline-offset-4"
          >
            Lihat berita
          </a>
        </div>
      ))}
    </div>
  );
}

export function ReportItem({
  report,
  regions,
  twins,
}: {
  report: ReportItemData;
  regions: RegionOption[];
  twins: CaseTwin[];
}) {
  const reasonLabel =
    REPORT_REASONS.find((r) => r.value === report.reason)?.label ??
    report.reason;
  const caseData = report.case;
  const fixDate = report.reported_date ?? caseData.occurred_on ?? undefined;
  const fixVictims =
    report.reported_victims !== null
      ? String(report.reported_victims)
      : caseData.victims !== null
        ? String(caseData.victims)
        : "";
  const tree = buildRegionTree(regions);

  return (
    <FramePanel>
      <FrameHeader className="gap-1.5 p-0">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge>
            <Flag />
            {reasonLabel}
          </Badge>
          <Badge variant="outline">
            <MapPin />
            {caseData.region.district}, {caseData.region.province}
          </Badge>
          <span>{shortDate(report.created_at)}</span>
        </div>
        <p className="text-[15px] leading-snug">{caseData.summary}</p>
        <a
          href={caseData.source_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-muted-foreground underline underline-offset-4"
        >
          Lihat berita sumber
        </a>
      </FrameHeader>
      <div className="flex flex-col gap-3 py-4">
        {report.reason !== "duplicate" && (
          <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            <Badge variant="secondary" size="sm">
              <Users />
              Tercatat: {caseData.victims ?? "-"} korban
            </Badge>
            {report.reported_victims !== null && (
              <Badge variant="destructive-light" size="sm">
                Usulan: {report.reported_victims} korban
              </Badge>
            )}
            <Badge variant="secondary" size="sm">
              Tanggal tercatat: {shortDate(caseData.occurred_on)}
            </Badge>
            {report.reported_date && (
              <Badge variant="destructive-light" size="sm">
                Usulan: {shortDate(report.reported_date)}
              </Badge>
            )}
          </div>
        )}
        {report.note && (
          <p className="text-sm leading-relaxed">“{report.note}”</p>
        )}
        {report.evidence_url && (
          <a
            href={report.evidence_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium underline underline-offset-4"
          >
            Bukti dari pelapor
          </a>
        )}

        {report.reason === "location" && (
          <form
            id={`move-${report.id}`}
            action={moveReportCase}
            className="flex flex-col gap-2"
          >
            <input type="hidden" name="reportId" value={report.id} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`region-${report.id}`}>
                Pindahkan ke wilayah yang benar
              </Label>
              <Cascader
                items={tree}
                name="regionId"
                id={`region-${report.id}`}
                searchScope="deep"
                renderLabel={renderRegionLabel}
                labels={{
                  search: (parent) =>
                    parent ? `Cari di ${parent}...` : "Ketik nama daerah",
                  back: "Kembali",
                  empty: "Tidak ada daerah yang cocok.",
                  keyboardHint: () =>
                    "Gunakan panah Kanan untuk membuka cabang dan panah Kiri untuk kembali.",
                }}
              >
                <CascaderTrigger
                  render={
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full justify-between font-normal"
                    />
                  }
                >
                  <CascaderValue placeholder="Pilih kabupaten/kota" />
                </CascaderTrigger>
                <CascaderContent>
                  <CascaderPanel>
                    <CascaderNav>
                      <CascaderBreadcrumb />
                      <CascaderInput />
                    </CascaderNav>
                    <CascaderEmpty />
                    <CascaderList maxHeight={288}>
                      <CascaderItems />
                    </CascaderList>
                    <CascaderStatus />
                  </CascaderPanel>
                </CascaderContent>
              </Cascader>
            </div>
          </form>
        )}

        {report.reason === "duplicate" && (
          <div className="flex flex-col gap-2">
            <Label>Kembaran yang mungkin</Label>
            <TwinList twins={twins} />
            <form id={`delete-${report.id}`} action={deleteReportedCase}>
              <input type="hidden" name="caseId" value={caseData.id} />
              <input type="hidden" name="reportId" value={report.id} />
            </form>
            <p className="text-xs text-muted-foreground">
              Menghapus case terlapor di atas. Bisa dipulihkan lewat tab
              Terhapus.
            </p>
          </div>
        )}

        {report.reason !== "location" && report.reason !== "duplicate" && (
          <form
            id={`fix-${report.id}`}
            action={applyReportFix}
            className="flex flex-col gap-2"
          >
            <input type="hidden" name="reportId" value={report.id} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor={`fix-date-${report.id}`}>
                  Tanggal baru kasus
                </Label>
                <DateField
                  id={`fix-date-${report.id}`}
                  name="occurredOn"
                  defaultValue={fixDate}
                />
              </div>
              <div className="flex w-full flex-col gap-1.5 sm:w-40">
                <Label htmlFor={`fix-victims-${report.id}`}>
                  Jumlah korban baru
                </Label>
                <Input
                  id={`fix-victims-${report.id}`}
                  name="victims"
                  type="number"
                  min={0}
                  defaultValue={fixVictims}
                />
              </div>
            </div>
          </form>
        )}

        <form id={`resolve-${report.id}`} action={resolveReport}>
          <input type="hidden" name="reportId" value={report.id} />
        </form>
        <form id={`dismiss-${report.id}`} action={dismissReport}>
          <input type="hidden" name="reportId" value={report.id} />
        </form>
      </div>
      <FrameFooter className="flex-row justify-end gap-2 p-0">
        <FormSubmitButton
          variant="outline"
          formId={`dismiss-${report.id}`}
          action={dismissReport}
        >
          Abaikan
        </FormSubmitButton>
        <FormSubmitButton
          variant="outline"
          formId={`resolve-${report.id}`}
          action={resolveReport}
        >
          Selesai
        </FormSubmitButton>
        {report.reason === "location" && (
          <FormSubmitButton
            formId={`move-${report.id}`}
            action={moveReportCase}
          >
            Pindah wilayah
          </FormSubmitButton>
        )}
        {report.reason === "duplicate" && (
          <FormSubmitButton
            variant="destructive"
            formId={`delete-${report.id}`}
            action={deleteReportedCase}
          >
            <Trash2 />
            Hapus case terlapor
          </FormSubmitButton>
        )}
        {report.reason !== "location" && report.reason !== "duplicate" && (
          <FormSubmitButton formId={`fix-${report.id}`} action={applyReportFix}>
            Terapkan koreksi
          </FormSubmitButton>
        )}
      </FrameFooter>
    </FramePanel>
  );
}
