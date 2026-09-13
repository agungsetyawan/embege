import { Frame, FramePanel } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

// Pengganti halaman admin selama navigasi tab dan pagination.
export default function AdminLoading() {
  return (
    <main
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4"
      aria-busy="true"
      aria-label="Memuat halaman admin"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-7 w-24" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-28" />
        </div>
      </div>
      <Frame stacked>
        {[0, 1, 2].map((i) => (
          <FramePanel key={i}>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-24 w-full" />
            </div>
          </FramePanel>
        ))}
      </Frame>
    </main>
  );
}
