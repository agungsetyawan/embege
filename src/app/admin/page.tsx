import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { PendingItem, type PendingItemData } from "./pending-item";
import { RejectedItem, type RejectedItemData } from "./rejected-item";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const params = await searchParams;
  const tab = params.tab === "auto" ? "auto" : "pending";
  const PAGE_SIZE = 20;
  const rawPage = Number(params.page);
  const wantPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [{ count: pendingCount }, { count: autoCount }] = await Promise.all([
    supabase
      .from("crawl_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("crawl_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejected")
      .eq("llm_is_relevant", false),
  ]);

  const total = tab === "auto" ? (autoCount ?? 0) : (pendingCount ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(wantPage, totalPages);

  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = page * PAGE_SIZE - 1;
  const [{ data: items }, { data: regions }] = await Promise.all([
    tab === "auto"
      ? supabase
          .from("crawl_items")
          .select(
            "id,title,summary,url,media,published_at,llm_summary,llm_reject_reason",
          )
          .eq("status", "rejected")
          .eq("llm_is_relevant", false)
          .order("published_at", { ascending: false, nullsFirst: false })
          .range(rangeFrom, rangeTo)
      : supabase
          .from("crawl_items")
          .select(
            "id,title,summary,url,media,published_at,guessed_region_id,llm_summary,geo_confidence",
          )
          .eq("status", "pending")
          .order("published_at", { ascending: false, nullsFirst: false })
          .range(rangeFrom, rangeTo),
    supabase
      .from("regions")
      .select("id,province,district,centroid_ok")
      .order("province")
      .order("district"),
  ]);
  const pageQuery = (p: number) =>
    tab === "auto" ? `/admin?tab=auto&page=${p}` : `/admin?page=${p}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Kurasi Berita
          </h1>
          <Badge variant="secondary">{pendingCount ?? 0} antre</Badge>
          <Badge variant="outline">{autoCount ?? 0} ditolak otomatis</Badge>
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
      <nav aria-label="Tab kurasi" className="flex gap-2">
        <Button
          variant={tab === "pending" ? "default" : "outline"}
          size="sm"
          asChild
        >
          <Link href="/admin">Antrean</Link>
        </Button>
        <Button
          variant={tab === "auto" ? "default" : "outline"}
          size="sm"
          asChild
        >
          <Link href="/admin?tab=auto">Ditolak otomatis</Link>
        </Button>
      </nav>
      {(items?.length ?? 0) === 0 && (
        <p className="text-muted-foreground">
          {tab === "auto"
            ? "Belum ada berita yang ditolak otomatis."
            : "Antrean bersih. Berita baru masuk otomatis tiap jam."}
        </p>
      )}
      {tab === "auto"
        ? (items as RejectedItemData[] | undefined)?.map((item) => (
            <RejectedItem key={item.id} item={item} />
          ))
        : (items as PendingItemData[] | undefined)?.map((item) => (
            <PendingItem key={item.id} item={item} regions={regions ?? []} />
          ))}
      {totalPages > 1 && (
        <nav
          aria-label="Halaman antrean"
          className="flex items-center justify-center gap-3"
        >
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageQuery(page - 1)}>Sebelumnya</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Sebelumnya
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Halaman {page} dari {totalPages}
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageQuery(page + 1)}>Berikutnya</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Berikutnya
            </Button>
          )}
        </nav>
      )}
    </main>
  );
}
