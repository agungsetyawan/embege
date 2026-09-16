export function MapLegend() {
  return (
    <div className="flex gap-4 text-xs text-muted-foreground">
      <span>
        <i
          aria-hidden="true"
          className="mr-1 inline-block h-2 w-2 bg-[#eab308]"
        />
        1 kasus
      </span>
      <span>
        <i
          aria-hidden="true"
          className="mr-1 inline-block h-2 w-2 bg-[#f97316]"
        />
        2-4 kasus
      </span>
      <span>
        <i
          aria-hidden="true"
          className="mr-1 inline-block h-2 w-2 bg-[#dc2626]"
        />
        5+ kasus
      </span>
    </div>
  );
}
