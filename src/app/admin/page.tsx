import { Inbox } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/reui/badge";
import { Frame, FramePanel } from "@/components/reui/frame";
import { IconStack } from "@/components/reui/icon-stack";
import { Button } from "@/components/ui/button";
import { NavLinkStatus } from "@/components/ui/nav-link-status";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader } from "./admin-header";
import { DeletedItem, type DeletedItemData } from "./deleted-item";
import {
  type DuplicateCase,
  PendingItem,
  type PendingItemData,
} from "./pending-item";
import { RejectedItem, type RejectedItemData } from "./rejected-item";
import { type CaseTwin, ReportItem, type ReportItemData } from "./report-item";

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
  const tab =
    params.tab === "rejected"
      ? "rejected"
      : params.tab === "reports"
        ? "reports"
        : params.tab === "deleted"
          ? "deleted"
          : "pending";
  const PAGE_SIZE = 20;
  const rawPage = Number(params.page);
  const wantPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

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

  const total =
    tab === "rejected"
      ? (autoCount ?? 0)
      : tab === "reports"
        ? (reportCount ?? 0)
        : tab === "deleted"
          ? (deletedCount ?? 0)
          : (pendingCount ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(wantPage, totalPages);

  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = page * PAGE_SIZE - 1;
  const [{ data: items }, { data: regions }] = await Promise.all([
    tab === "rejected"
      ? supabase
          .from("crawl_items")
          .select(
            "id,title,summary,url,media,published_at,llm_summary,llm_reject_reason",
          )
          .eq("status", "rejected")
          .eq("llm_is_relevant", false)
          .order("published_at", { ascending: false, nullsFirst: false })
          .range(rangeFrom, rangeTo)
      : tab === "reports"
        ? supabase
            .from("case_reports")
            .select(
              "id,reason,reported_victims,reported_date,note,evidence_url,created_at,case:cases!inner(id,region_id,summary,victims,occurred_on,source_url,region:regions(province,district))",
            )
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .range(rangeFrom, rangeTo)
        : tab === "deleted"
          ? supabase
              .from("cases")
              .select(
                "id,summary,victims,occurred_on,source_media,source_url,deleted_at,region:regions(province,district)",
              )
              .not("deleted_at", "is", null)
              .order("deleted_at", { ascending: false })
              .range(rangeFrom, rangeTo)
          : supabase
              .from("crawl_items")
              .select(
                "id,title,summary,url,media,published_at,guessed_region_id,llm_summary,llm_victims,geo_confidence,duplicate_of_case_id,duplicate_confidence,duplicate_reason",
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

  // Candidate duplicates for "duplicate-news" reports: same source URL
  // (classic double-approve) or same region + same date.
  const twinsByReport = new Map<string, CaseTwin[]>();
  if (tab === "reports") {
    const dupReports = (
      (items as unknown as ReportItemData[] | undefined) ?? []
    ).filter((r) => r.reason === "duplicate");
    await Promise.all(
      dupReports.map(async (r) => {
        const c = r.case;
        const [byUrl, byEvent] = await Promise.all([
          supabase
            .from("cases")
            .select("id,summary,victims,occurred_on,source_media,source_url")
            .eq("source_url", c.source_url)
            .neq("id", c.id)
            .is("deleted_at", null)
            .limit(5),
          c.occurred_on
            ? supabase
                .from("cases")
                .select(
                  "id,summary,victims,occurred_on,source_media,source_url",
                )
                .eq("region_id", c.region_id)
                .eq("occurred_on", c.occurred_on)
                .neq("id", c.id)
                .is("deleted_at", null)
                .limit(5)
            : Promise.resolve({ data: [] as CaseTwin[] }),
        ]);
        const seen = new Set<string>();
        const twins: CaseTwin[] = [];
        for (const row of [...(byUrl.data ?? []), ...(byEvent.data ?? [])]) {
          if (seen.has(row.id) || twins.length >= 5) continue;
          seen.add(row.id);
          twins.push(row);
        }
        twinsByReport.set(r.id, twins);
      }),
    );
  }

  const pageQuery = (p: number) =>
    tab === "rejected"
      ? `/admin?tab=rejected&page=${p}`
      : tab === "reports"
        ? `/admin?tab=reports&page=${p}`
        : tab === "deleted"
          ? `/admin?tab=deleted&page=${p}`
          : `/admin?page=${p}`;

  // Duplicate hints for pending items: fetch the referenced published cases.
  const duplicatesByItem = new Map<string, DuplicateCase>();
  if (tab === "pending") {
    const ids = ((items as unknown as PendingItemData[] | undefined) ?? [])
      .map((i) => i.duplicate_of_case_id)
      .filter(Boolean) as string[];
    if (ids.length > 0) {
      const { data: dupCases } = await supabase
        .from("cases")
        .select("id,summary,victims,occurred_on,source_media")
        .in("id", [...new Set(ids)]);
      for (const c of dupCases ?? []) duplicatesByItem.set(c.id, c);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <AdminHeader
        active={tab}
        title="Kurasi Berita"
        meta={
          <>
            <Badge variant="secondary">{pendingCount ?? 0} antre</Badge>
            <Badge variant="outline">{autoCount ?? 0} ditolak otomatis</Badge>
            <Badge variant="outline">{reportCount ?? 0} laporan</Badge>
            <Badge variant="outline">{deletedCount ?? 0} terhapus</Badge>
          </>
        }
        email={user.email}
      />
      {(items?.length ?? 0) === 0 ? (
        <Frame>
          <FramePanel className="flex flex-col items-center gap-1.5 py-8 text-center">
            <IconStack aria-hidden="true">
              <Inbox className="size-4" />
            </IconStack>
            <p className="font-medium">
              {tab === "rejected"
                ? "Belum ada berita yang ditolak otomatis."
                : tab === "reports"
                  ? "Belum ada laporan masuk."
                  : tab === "deleted"
                    ? "Tidak ada case yang dihapus."
                    : "Antrean bersih."}
            </p>
            {tab === "pending" && (
              <p className="text-sm text-muted-foreground">
                Berita baru masuk otomatis tiap jam.
              </p>
            )}
          </FramePanel>
        </Frame>
      ) : (
        <Frame stacked>
          {tab === "rejected"
            ? (items as RejectedItemData[] | undefined)?.map((item) => (
                <RejectedItem key={item.id} item={item} />
              ))
            : tab === "reports"
              ? (items as unknown as ReportItemData[] | undefined)?.map(
                  (report) => (
                    <ReportItem
                      key={report.id}
                      report={report}
                      regions={regions ?? []}
                      twins={twinsByReport.get(report.id) ?? []}
                    />
                  ),
                )
              : tab === "deleted"
                ? (items as unknown as DeletedItemData[] | undefined)?.map(
                    (item) => <DeletedItem key={item.id} item={item} />,
                  )
                : (items as PendingItemData[] | undefined)?.map((item) => (
                    <PendingItem
                      key={item.id}
                      item={item}
                      regions={regions ?? []}
                      duplicate={
                        item.duplicate_of_case_id
                          ? (duplicatesByItem.get(item.duplicate_of_case_id) ??
                            null)
                          : null
                      }
                    />
                  ))}
        </Frame>
      )}
      {totalPages > 1 && (
        <nav
          aria-label="Halaman antrean"
          className="flex items-center justify-center gap-3"
        >
          {page > 1 ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={pageQuery(page - 1)} />}
            >
              Sebelumnya
              <NavLinkStatus />
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
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={pageQuery(page + 1)} />}
            >
              Berikutnya
              <NavLinkStatus />
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
