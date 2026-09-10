"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
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
  if (!regionId || !summary) return;

  const { data: item } = await supabase
    .from("crawl_items")
    .select("url,media")
    .eq("id", itemId)
    .eq("status", "pending")
    .single();
  if (!item) return;

  const victims = victimsRaw === "" ? null : Number(victimsRaw);
  const { data: inserted, error } = await supabase
    .from("cases")
    .insert({
      region_id: regionId,
      occurred_on: occurredRaw || null,
      victims:
        victims === null || Number.isNaN(victims) ? null : Math.trunc(victims),
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
  await supabase
    .from("crawl_items")
    .update({ status: "rejected" })
    .eq("id", String(formData.get("itemId")));
  revalidatePath("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
