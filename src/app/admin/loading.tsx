import { Frame, FramePanel } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors QueueFilters grid + PendingItem order so the resolved list
// lands without a layout jump.
export default function AdminLoading() {
  return (
    <section
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4"
      aria-busy="true"
      aria-label="Memuat halaman admin"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_200px_auto]">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-9" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-8" />
        </div>
        <div className="flex items-end">
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <Frame stacked>
        {[0, 1, 2].map((i) => (
          <FramePanel key={i}>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          </FramePanel>
        ))}
      </Frame>
    </section>
  );
}
