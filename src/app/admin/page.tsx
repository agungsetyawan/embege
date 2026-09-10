import Link from "next/link";
import { redirect } from "next/navigation";
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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Kurasi Berita ({items?.length ?? 0})
          </h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
        <form action={signOut} className="flex items-center gap-3">
          <Link
            href="/admin/settings"
            className="rounded border px-3 py-1.5 text-sm"
          >
            Pengaturan
          </Link>
          <button type="submit" className="rounded border px-3 py-1.5 text-sm">
            Keluar
          </button>
        </form>
      </header>
      {(items?.length ?? 0) === 0 && (
        <p className="text-zinc-500">
          Antrean kosong. Crawler berjalan tiap jam.
        </p>
      )}
      {items?.map((item) => (
        <PendingItem key={item.id} item={item} regions={regions ?? []} />
      ))}
    </main>
  );
}
