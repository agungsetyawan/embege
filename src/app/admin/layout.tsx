import type { Metadata } from "next";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Logged out: render the login page bare, without the sidebar shell.
  if (!user) return <>{children}</>;

  const [
    { count: pendingCount },
    { count: autoCount },
    { count: reportCount },
    { count: deletedCount },
  ] = await Promise.all([
    supabase
      .from("crawl_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("crawl_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejected")
      .eq("llm_is_relevant", false),
    supabase
      .from("case_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
  ]);

  const counts = {
    pending: pendingCount ?? 0,
    auto: autoCount ?? 0,
    reports: reportCount ?? 0,
    deleted: deletedCount ?? 0,
  };

  return (
    <SidebarProvider>
      <AdminSidebar counts={counts} email={user.email} />
      <SidebarInset>
        <AdminTopbar counts={counts} />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
