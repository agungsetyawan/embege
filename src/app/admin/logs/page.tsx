import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QueuePagination } from "../queue-pagination";
import { type CronLogRow, CronLogsTable } from "./cron-logs-table";

const PAGE_SIZE = 20;

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const params = await searchParams;
  const rawPage = Number(params.page);
  const wantPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const fetchPage = (offset: number) =>
    supabase.rpc("get_cron_http_logs", {
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
  const { data: first } = await fetchPage((wantPage - 1) * PAGE_SIZE);
  let logs = (first ?? []) as CronLogRow[];
  // Page out of range after 6-hour rows expire: fall back to page 1.
  if (logs.length === 0 && wantPage > 1) {
    const { data: fallback } = await fetchPage(0);
    logs = (fallback ?? []) as CronLogRow[];
  }
  const filteredTotal = logs.length > 0 ? logs[0].full_count : 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const page = Math.min(wantPage, totalPages);

  const pageQuery = (p: number) => `/admin/logs?page=${p}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4">
      <p className="text-sm text-muted-foreground">
        Cron HTTP responses from the last 6 hours. Old rows are deleted
        automatically by pg_net.
      </p>
      <CronLogsTable rows={logs} />
      {totalPages > 1 && (
        <QueuePagination
          page={page}
          totalPages={totalPages}
          total={filteredTotal}
          pageSize={PAGE_SIZE}
          pageQuery={pageQuery}
          className="sticky bottom-0 z-30 -mx-4 -mb-4 border-t border-border bg-background/95 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur"
        />
      )}
    </div>
  );
}
