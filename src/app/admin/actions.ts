"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type AdminLogEntry, logAdminAction } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const log = (entry: AdminLogEntry) => logAdminAction(supabase, user, entry);
  return { supabase, user, log };
}

export async function approveItem(formData: FormData) {
  const { supabase, log } = await requireAdmin();
  const itemId = String(formData.get("itemId"));
  const regionId = String(formData.get("regionId"));
  const summary = String(formData.get("summary") ?? "").trim();
  const occurredRaw = String(formData.get("occurredOn") ?? "");
  const victimsRaw = String(formData.get("victims") ?? "");
  const schoolRaw = String(formData.get("school") ?? "").trim();
  const sppgRaw = String(formData.get("sppg") ?? "").trim();
  if (!isUuid(itemId) || !isUuid(regionId)) return;
  if (!summary || summary.length > 5000) return;
  if (schoolRaw.length > 500 || sppgRaw.length > 500) return;

  const victims = victimsRaw === "" ? null : Number(victimsRaw);
  if (
    victims !== null &&
    (!Number.isInteger(victims) || victims < 0 || victims > 9999)
  )
    return;
  const occurredOn =
    occurredRaw === ""
      ? null
      : /^\d{4}-\d{2}-\d{2}$/.test(occurredRaw) &&
          !Number.isNaN(Date.parse(occurredRaw))
        ? occurredRaw
        : undefined;
  if (occurredOn === undefined) return;

  const { data: item } = await supabase
    .from("crawl_items")
    .select("url,media")
    .eq("id", itemId)
    .eq("status", "pending")
    .single();
  if (!item) return;

  const school = schoolRaw === "" ? null : schoolRaw;
  const sppg = sppgRaw === "" ? null : sppgRaw;
  const { data: inserted, error } = await supabase
    .from("cases")
    .insert({
      region_id: regionId,
      occurred_on: occurredOn,
      victims,
      summary,
      school,
      sppg,
      source_url: item.url,
      source_media: item.media,
    })
    .select("id")
    .single();
  if (error || !inserted) return;

  await supabase
    .from("crawl_items")
    .update({ status: "approved", case_id: inserted.id })
    .eq("id", itemId);
  await log({
    action: "crawl.approve",
    table: "cases",
    rowId: inserted.id,
    diff: { from_item: itemId, region_id: regionId },
  });
  revalidatePath("/admin");
}

export async function rejectItem(formData: FormData) {
  const { supabase, log } = await requireAdmin();
  const itemId = String(formData.get("itemId"));
  if (!isUuid(itemId)) return;
  await supabase
    .from("crawl_items")
    .update({ status: "rejected" })
    .eq("id", itemId);
  await log({
    action: "crawl.reject",
    table: "crawl_items",
    rowId: itemId,
  });
  revalidatePath("/admin");
}

// Apply a duplicate-flagged item as an update to its published case:
// victims/summary/source move to the newer article, then older pending
// siblings for the same case are auto-rejected as superseded.
export async function applyItemUpdate(formData: FormData) {
  const { supabase, user, log } = await requireAdmin();
  const itemId = String(formData.get("itemId"));
  if (!isUuid(itemId)) return;

  const { data: item } = await supabase
    .from("crawl_items")
    .select(
      "status,url,media,published_at,llm_summary,llm_victims,llm_school,llm_sppg,duplicate_of_case_id",
    )
    .eq("id", itemId)
    .single();
  if (!item || item.status !== "pending" || !item.duplicate_of_case_id) return;
  if (!item.llm_summary) return;

  const { data: target } = await supabase
    .from("cases")
    .select("id,victims,occurred_on,school,sppg")
    .eq("id", item.duplicate_of_case_id)
    .is("deleted_at", null)
    .single();
  if (!target) return;

  const victims = item.llm_victims ?? target.victims;
  const { error } = await supabase
    .from("cases")
    .update({
      victims,
      school: item.llm_school ?? target.school,
      sppg: item.llm_sppg ?? target.sppg,
      // The news date is not the event date: only fill an empty one.
      occurred_on:
        target.occurred_on ?? item.published_at?.slice(0, 10) ?? null,
      summary: item.llm_summary,
      source_url: item.url,
      source_media: item.media,
      updated_at: new Date().toISOString(),
      updated_by_email: user.email ?? null,
    })
    .eq("id", target.id);
  if (error) return;

  await supabase
    .from("crawl_items")
    .update({ status: "approved", case_id: target.id })
    .eq("id", itemId);

  if (item.published_at) {
    await supabase
      .from("crawl_items")
      .update({
        status: "rejected",
        llm_is_relevant: false,
        llm_reject_reason: "Kedaluarsa: sudah ada update lebih baru.",
      })
      .eq("status", "pending")
      .eq("duplicate_of_case_id", target.id)
      .neq("id", itemId)
      .lt("published_at", item.published_at);
  }

  await log({
    action: "crawl.apply_update",
    table: "cases",
    rowId: target.id,
    diff: {
      from_item: itemId,
      victims: { from: target.victims, to: victims },
    },
  });
  revalidatePath("/admin");
}

export async function restoreItem(formData: FormData) {
  const { supabase, log } = await requireAdmin();
  const itemId = String(formData.get("itemId"));
  if (!isUuid(itemId)) return;
  // Keep llm_summary filled so the item is not re-enriched and does not
  // hit the auto-reject loop; the curator just approves/rejects manually.
  await supabase
    .from("crawl_items")
    .update({ status: "pending", llm_is_relevant: null })
    .eq("id", itemId);
  await log({
    action: "crawl.restore",
    table: "crawl_items",
    rowId: itemId,
  });
  revalidatePath("/admin");
}

export async function resolveReport(formData: FormData) {
  const { supabase, log } = await requireAdmin();
  const reportId = String(formData.get("reportId"));
  if (!isUuid(reportId)) return;
  await supabase
    .from("case_reports")
    .update({ status: "resolved" })
    .eq("id", reportId);
  await log({
    action: "report.resolve",
    table: "case_reports",
    rowId: reportId,
  });
  revalidatePath("/admin");
}

export async function dismissReport(formData: FormData) {
  const { supabase, log } = await requireAdmin();
  const reportId = String(formData.get("reportId"));
  if (!isUuid(reportId)) return;
  await supabase
    .from("case_reports")
    .update({ status: "dismissed" })
    .eq("id", reportId);
  await log({
    action: "report.dismiss",
    table: "case_reports",
    rowId: reportId,
  });
  revalidatePath("/admin");
}

// Move the reported case to the region the reporter says is correct.
export async function moveReportCase(formData: FormData) {
  const { supabase, user, log } = await requireAdmin();
  const reportId = String(formData.get("reportId"));
  const regionId = String(formData.get("regionId"));
  if (!isUuid(reportId) || !isUuid(regionId)) return;

  const { data: report } = await supabase
    .from("case_reports")
    .select("case_id")
    .eq("id", reportId)
    .single();
  if (!report) return;

  const { error } = await supabase
    .from("cases")
    .update({
      region_id: regionId,
      updated_at: new Date().toISOString(),
      updated_by_email: user.email ?? null,
    })
    .eq("id", report.case_id);
  if (error) return;

  await supabase
    .from("case_reports")
    .update({ status: "resolved" })
    .eq("id", reportId);
  await log({
    action: "report.move_case",
    table: "cases",
    rowId: report.case_id,
    diff: { region_id: regionId, from_report: reportId },
  });
  revalidatePath("/admin");
}

// Soft-delete the reported duplicate so it can be restored from the
// "Deleted" tab if the call turns out to be wrong.
export async function deleteReportedCase(formData: FormData) {
  const { supabase, log } = await requireAdmin();
  const caseId = String(formData.get("caseId"));
  const reportId = String(formData.get("reportId"));
  if (!isUuid(caseId)) return;
  const { error } = await supabase
    .from("cases")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", caseId);
  if (error) return;
  if (isUuid(reportId)) {
    await supabase
      .from("case_reports")
      .update({ status: "resolved" })
      .eq("id", reportId);
  }
  await log({
    action: "case.delete",
    table: "cases",
    rowId: caseId,
    diff: { from_report: isUuid(reportId) ? reportId : null },
  });
  revalidatePath("/admin");
}

export async function restoreCase(formData: FormData) {
  const { supabase, log } = await requireAdmin();
  const caseId = String(formData.get("caseId"));
  if (!isUuid(caseId)) return;
  await supabase.from("cases").update({ deleted_at: null }).eq("id", caseId);
  await log({
    action: "case.restore",
    table: "cases",
    rowId: caseId,
  });
  revalidatePath("/admin");
  revalidatePath("/admin/cases");
}

// Apply the reporter's suggested values to the case, then mark the report
// resolved. Empty inputs clear the field, same semantics as approveItem.
export async function applyReportFix(formData: FormData) {
  const { supabase, user, log } = await requireAdmin();
  const reportId = String(formData.get("reportId"));
  if (!isUuid(reportId)) return;
  const victimsRaw = String(formData.get("victims") ?? "");
  const occurredRaw = String(formData.get("occurredOn") ?? "");
  const victims = victimsRaw === "" ? null : Number(victimsRaw);
  if (
    victims !== null &&
    (!Number.isInteger(victims) || victims < 0 || victims > 9999)
  )
    return;
  const occurredOn =
    occurredRaw === ""
      ? null
      : /^\d{4}-\d{2}-\d{2}$/.test(occurredRaw) &&
          !Number.isNaN(Date.parse(occurredRaw))
        ? occurredRaw
        : undefined;
  if (occurredOn === undefined) return;

  const { data: report } = await supabase
    .from("case_reports")
    .select("case_id")
    .eq("id", reportId)
    .single();
  if (!report) return;

  const { error } = await supabase
    .from("cases")
    .update({
      victims,
      occurred_on: occurredOn,
      updated_at: new Date().toISOString(),
      updated_by_email: user.email ?? null,
    })
    .eq("id", report.case_id);
  if (error) return;

  await supabase
    .from("case_reports")
    .update({ status: "resolved" })
    .eq("id", reportId);
  await log({
    action: "report.apply_fix",
    table: "cases",
    rowId: report.case_id,
    diff: { victims, occurred_on: occurredOn, from_report: reportId },
  });
  revalidatePath("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
