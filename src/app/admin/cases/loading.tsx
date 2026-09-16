import { Skeleton } from "@/components/ui/skeleton";

// Case data page placeholder during filter navigation and pagination.
export default function CasesLoading() {
  return (
    <main
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4"
      aria-busy="true"
      aria-label="Memuat halaman kasus"
    >
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    </main>
  );
}
