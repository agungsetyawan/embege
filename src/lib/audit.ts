import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminActor = { id: string; email?: string | null };

export type AdminLogEntry = {
  action: string;
  table: string;
  rowId?: string | null;
  diff?: Record<string, unknown> | null;
};

// Best-effort audit trail: failures never block the admin action itself.
export async function logAdminAction(
  supabase: SupabaseClient,
  actor: AdminActor,
  entry: AdminLogEntry,
) {
  try {
    await supabase.from("admin_audit_log").insert({
      actor_id: actor.id,
      actor_email: actor.email ?? null,
      action: entry.action,
      table_name: entry.table,
      row_id: entry.rowId ?? null,
      diff: entry.diff ?? null,
    });
  } catch {
    // Audit is observability, not the write path. Ignore.
  }
}
