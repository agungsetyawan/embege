import { Frame, FramePanel } from "@/components/reui/frame";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the Umum + Keyword sections of the settings page.
export default function SettingsLoading() {
  return (
    <section
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4"
      aria-busy="true"
      aria-label="Memuat pengaturan"
    >
      <section className="flex flex-col gap-3">
        <Skeleton className="h-6 w-24" />
        <Frame stacked>
          {[0, 1, 2].map((i) => (
            <FramePanel key={i}>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 flex-1" />
                  <Skeleton className="h-9 w-20" />
                </div>
              </div>
            </FramePanel>
          ))}
        </Frame>
      </section>
      <section className="flex flex-col gap-3">
        <Skeleton className="h-6 w-24" />
        <Frame stacked>
          {[0, 1].map((i) => (
            <FramePanel key={i}>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            </FramePanel>
          ))}
        </Frame>
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-20" />
        </div>
      </section>
    </section>
  );
}
