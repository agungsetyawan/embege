"use server";

import { revalidatePath } from "next/cache";
import { isHttpUrl, isUuid } from "@/lib/validate";
import { requireAdmin } from "../actions";

function parseVictims(raw: string): number | null | undefined {
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 9999) return undefined;
  return n;
}

function parseDate(raw: string): string | null | undefined {
  if (raw === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw)))
    return raw;
  return undefined;
}

// Full edit of a case from /admin/cases. Records changed fields + actor.
export async function updateCase(formData: FormData) {
  const { supabase, user, log } = await requireAdmin();
  const caseId = String(formData.get("caseId"));
  const regionId = String(formData.get("regionId"));
  const summary = String(formData.get("summary") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const sourceMedia = String(formData.get("sourceMedia") ?? "").trim();
  const schoolRaw = String(formData.get("school") ?? "").trim();
  const sppgRaw = String(formData.get("sppg") ?? "").trim();
  if (!isUuid(caseId) || !isUuid(regionId)) return;
  if (!summary || summary.length > 5000) return;
  if (!isHttpUrl(sourceUrl) || sourceUrl.length > 2000) return;
  if (!sourceMedia || sourceMedia.length > 200) return;
  if (schoolRaw.length > 500 || sppgRaw.length > 500) return;

  const victims = parseVictims(String(formData.get("victims") ?? ""));
  const occurredOn = parseDate(String(formData.get("occurredOn") ?? ""));
  if (victims === undefined || occurredOn === undefined) return;
  const published = formData.get("published") === "on";

  const school = schoolRaw === "" ? null : schoolRaw;
  const sppg = sppgRaw === "" ? null : sppgRaw;
  const { data: before } = await supabase
    .from("cases")
    .select(
      "region_id,occurred_on,victims,summary,school,sppg,source_url,source_media,published",
    )
    .eq("id", caseId)
    .single();
  if (!before) return;

  const after = {
    region_id: regionId,
    occurred_on: occurredOn,
    victims,
    summary,
    school,
    sppg,
    source_url: sourceUrl,
    source_media: sourceMedia,
    published,
  };
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const [k, v] of Object.entries(after)) {
    if ((before as Record<string, unknown>)[k] !== v) {
      changed[k] = { from: (before as Record<string, unknown>)[k], to: v };
    }
  }
  if (Object.keys(changed).length === 0) return;

  const { error } = await supabase
    .from("cases")
    .update({
      ...after,
      updated_at: new Date().toISOString(),
      updated_by_email: user.email ?? null,
    })
    .eq("id", caseId);
  if (error) return;

  await log({
    action: "case.update",
    table: "cases",
    rowId: caseId,
    diff: changed,
  });
  revalidatePath("/admin/cases");
}

export async function deleteCase(formData: FormData) {
  const { supabase, user, log } = await requireAdmin();
  const caseId = String(formData.get("caseId"));
  if (!isUuid(caseId)) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("cases")
    .update({
      deleted_at: now,
      updated_at: now,
      updated_by_email: user.email ?? null,
    })
    .eq("id", caseId);
  if (error) return;
  await log({
    action: "case.delete",
    table: "cases",
    rowId: caseId,
  });
  revalidatePath("/admin/cases");
}

export type CaseHistoryEntry = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  diff: Record<string, unknown> | null;
};

export async function getCaseHistory(
  caseId: string,
): Promise<CaseHistoryEntry[]> {
  const { supabase } = await requireAdmin();
  if (!isUuid(caseId)) return [];
  const { data } = await supabase
    .from("admin_audit_log")
    .select("id,created_at,actor_email,action,diff")
    .eq("row_id", caseId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as CaseHistoryEntry[];
}
