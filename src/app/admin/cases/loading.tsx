import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the cases filter grid + DataGrid order so the resolved table
// lands without a layout jump.
export default function CasesLoading() {
  return (
    <section
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4"
      aria-busy="true"
      aria-label="Memuat halaman kasus"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-9" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-8" />
          </div>
        ))}
        <div className="flex items-end gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-16" />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex gap-2 border-b border-border px-3 py-2.5">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="hidden h-4 w-20 md:block" />
          <Skeleton className="h-4 w-16" />
        </div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 border-b border-border px-3 py-3 last:border-0"
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="hidden h-8 w-24 sm:block" />
            <Skeleton className="hidden h-8 w-20 md:block" />
            <Skeleton className="h-8 w-16" />
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
