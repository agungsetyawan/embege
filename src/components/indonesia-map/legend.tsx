export function MapLegend() {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-md border bg-popover p-1.5 text-[10px] leading-relaxed text-muted-foreground shadow-md md:flex-row md:items-center md:gap-4 md:px-3">
      <span>
        <i aria-hidden="true" className="inline-block h-2 w-2 bg-[#eab308]" />
        <span className="ml-1">1 kasus</span>
      </span>
      <span>
        <i aria-hidden="true" className="inline-block h-2 w-2 bg-[#f97316]" />
        <span className="ml-1">2-4 kasus</span>
      </span>
      <span>
        <i aria-hidden="true" className="inline-block h-2 w-2 bg-[#dc2626]" />
        <span className="ml-1">5+ kasus</span>
      </span>
    </div>
  );
}
