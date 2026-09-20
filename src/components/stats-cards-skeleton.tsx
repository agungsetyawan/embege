import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Stats cards placeholder while the timeline data loads.
export function StatsCardsSkeleton() {
  return (
    <output
      className="flex gap-2 overflow-hidden pb-1 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0"
      aria-busy="true"
      aria-label="Memuat statistik"
    >
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} size="sm" className="min-w-[170px] gap-2 lg:min-w-0">
          <CardHeader className="flex items-center gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-5 w-25" />
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            <Skeleton className="h-9 w-15" />
            <Skeleton className="h-4.5 w-30 rounded-full" />
          </CardContent>
        </Card>
      ))}
    </output>
  );
}
