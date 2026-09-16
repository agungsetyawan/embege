import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Stats cards placeholder while the timeline data loads.
export function StatsCardsSkeleton() {
  return (
    <output
      className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
      aria-busy="true"
      aria-label="Memuat statistik"
    >
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} size="sm" className="gap-2">
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
