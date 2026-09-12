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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
