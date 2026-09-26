import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the cron logs description + table order.
export default function LogsLoading() {
  return (
    <section
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4"
      aria-busy="true"
      aria-label="Memuat log cron"
    >
      <Skeleton className="h-4" />
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex gap-2 border-b border-border px-3 py-2.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 flex-1" />
        </div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 border-b border-border px-3 py-3 last:border-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    </section>
  );
}
