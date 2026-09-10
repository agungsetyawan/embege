import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { PendingItem } from "./pending-item";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: items }, { data: regions }] = await Promise.all([
    supabase
      .from("crawl_items")
      .select(
        "id,title,summary,url,media,published_at,guessed_region_id,llm_summary,geo_confidence",
      )
      .eq("status", "pending")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from("regions")
      .select("id,province,district,centroid_ok")
      .order("province")
      .order("district"),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Kurasi Berita
          </h1>
          <Badge variant="secondary">{items?.length ?? 0} antre</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user.email}
          </span>
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/settings">Pengaturan</Link>
          </Button>
          <form action={signOut}>
            <Button variant="outline" size="sm" type="submit">
              Keluar
            </Button>
          </form>
        </div>
      </header>
      {(items?.length ?? 0) === 0 && (
        <p className="text-muted-foreground">
          Antrean kosong. Crawler berjalan tiap jam.
        </p>
      )}
      {items?.map((item) => (
        <PendingItem key={item.id} item={item} regions={regions ?? []} />
      ))}
    </main>
  );
}
