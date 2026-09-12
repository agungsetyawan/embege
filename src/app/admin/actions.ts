"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

export async function approveItem(formData: FormData) {
  const supabase = await requireAdmin();
  const itemId = String(formData.get("itemId"));
  const regionId = String(formData.get("regionId"));
  const summary = String(formData.get("summary") ?? "").trim();
  const occurredRaw = String(formData.get("occurredOn") ?? "");
  const victimsRaw = String(formData.get("victims") ?? "");
  if (!isUuid(itemId) || !isUuid(regionId)) return;
  if (!summary || summary.length > 5000) return;

  const victims = victimsRaw === "" ? null : Number(victimsRaw);
  if (
    victims !== null &&
    (!Number.isInteger(victims) || victims < 0 || victims > 1000000)
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

  const { data: inserted, error } = await supabase
    .from("cases")
    .insert({
      region_id: regionId,
      occurred_on: occurredOn,
      victims,
      summary,
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
  revalidatePath("/admin");
}

export async function rejectItem(formData: FormData) {
  const supabase = await requireAdmin();
  const itemId = String(formData.get("itemId"));
  if (!isUuid(itemId)) return;
  await supabase
    .from("crawl_items")
    .update({ status: "rejected" })
    .eq("id", itemId);
  revalidatePath("/admin");
}

export async function restoreItem(formData: FormData) {
  const supabase = await requireAdmin();
  const itemId = String(formData.get("itemId"));
  if (!isUuid(itemId)) return;
  // Keep llm_summary filled so the item is not re-enriched and does not
  // hit the auto-reject loop; the curator just approves/rejects manually.
  await supabase
    .from("crawl_items")
    .update({ status: "pending", llm_is_relevant: null })
    .eq("id", itemId);
  revalidatePath("/admin");
}

export async function resolveReport(formData: FormData) {
  const supabase = await requireAdmin();
  const reportId = String(formData.get("reportId"));
  if (!isUuid(reportId)) return;
  await supabase
    .from("case_reports")
    .update({ status: "resolved" })
    .eq("id", reportId);
  revalidatePath("/admin");
}

export async function dismissReport(formData: FormData) {
  const supabase = await requireAdmin();
  const reportId = String(formData.get("reportId"));
  if (!isUuid(reportId)) return;
  await supabase
    .from("case_reports")
    .update({ status: "dismissed" })
    .eq("id", reportId);
  revalidatePath("/admin");
}

// Move the reported case to the region the reporter says is correct.
export async function moveReportCase(formData: FormData) {
  const supabase = await requireAdmin();
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
    .update({ region_id: regionId })
    .eq("id", report.case_id);
  if (error) return;

  await supabase
    .from("case_reports")
    .update({ status: "resolved" })
    .eq("id", reportId);
  revalidatePath("/admin");
}

// Soft-delete the reported duplicate so it can be restored from the
// Terhapus tab if the call turns out to be wrong.
export async function deleteReportedCase(formData: FormData) {
  const supabase = await requireAdmin();
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
  revalidatePath("/admin");
}

export async function restoreCase(formData: FormData) {
  const supabase = await requireAdmin();
  const caseId = String(formData.get("caseId"));
  if (!isUuid(caseId)) return;
  await supabase.from("cases").update({ deleted_at: null }).eq("id", caseId);
  revalidatePath("/admin");
}

// Apply the reporter's suggested values to the case, then mark the report
// resolved. Empty inputs clear the field, same semantics as approveItem.
export async function applyReportFix(formData: FormData) {
  const supabase = await requireAdmin();
  const reportId = String(formData.get("reportId"));
  if (!isUuid(reportId)) return;
  const victimsRaw = String(formData.get("victims") ?? "");
  const occurredRaw = String(formData.get("occurredOn") ?? "");
  const victims = victimsRaw === "" ? null : Number(victimsRaw);
  if (
    victims !== null &&
    (!Number.isInteger(victims) || victims < 0 || victims > 1000000)
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
    .update({ victims, occurred_on: occurredOn })
    .eq("id", report.case_id);
  if (error) return;

  await supabase
    .from("case_reports")
    .update({ status: "resolved" })
    .eq("id", reportId);
  revalidatePath("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
