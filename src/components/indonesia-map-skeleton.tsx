import { Card } from "@/components/ui/card";

// Loading placeholder for the Indonesia map. Uses the public/id.svg
// silhouette as a mask so the shape follows the theme via tokens
// instead of the SVG's hardcoded green fill.
export function IndonesiaMapSkeleton() {
  return (
    <output aria-busy="true" aria-label="Memuat peta">
      <Card className="overflow-hidden p-0">
        <div className="flex h-[60vh] md:h-[70vh] w-full items-center justify-center bg-muted p-6">
          <div
            aria-hidden="true"
            className="h-full w-full animate-pulse bg-muted-foreground/30"
            style={{
              mask: "url(/id.svg) center/contain no-repeat",
              WebkitMask: "url(/id.svg) center/contain no-repeat",
            }}
          />
        </div>
      </Card>
    </output>
  );
}
