import { FileText, ShieldCheck, Siren, Users } from "lucide-react";
import { Alert, AlertTitle } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import { IconTile } from "@/components/reui/icon-tile";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buildFootnote, countSafeDays, formatDate } from "@/lib/timeline";
import { fetchTimeline } from "@/lib/timeline-data";
import { StatsScroll } from "./stats-scroll";

export async function StatsCards() {
  const data = await fetchTimeline().catch(() => null);
  if (!data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Penghitung hari gagal dimuat.</AlertTitle>
      </Alert>
    );
  }

  const { timeline, unknownDate, future } = data;
  const poisoned = new Set(timeline.map((t) => t.date));
  const first = timeline.at(-1)?.date ?? null;
  const poisonedDays = timeline.length;
  const safeDays = first ? countSafeDays(first, poisoned) : 0;
  const totalCases = timeline.reduce((t, d) => t + d.cases, 0);
  const totalVictims = timeline.reduce((t, d) => t + d.victims, 0);
  const footnote = buildFootnote(unknownDate, future);

  const numberClass =
    "text-xl font-semibold tracking-tight tabular-nums sm:text-2xl";

  return (
    <div className="flex flex-col gap-1 -mx-4 lg:mx-0">
      <StatsScroll>
        <Card size="sm" className="min-w-[160px] snap-start gap-2 lg:min-w-0">
          <CardHeader>
            <span className="flex items-center gap-2">
              <IconTile
                variant="soft"
                size="sm"
                className="text-primary-foreground dark:text-primary"
              >
                <FileText />
              </IconTile>
              <span className="text-sm font-medium text-muted-foreground">
                Kasus
              </span>
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            <span className={numberClass}>
              {totalCases.toLocaleString("id-ID")}
            </span>
            <Badge variant="primary-light" size="sm" radius="full">
              laporan terkurasi
            </Badge>
          </CardContent>
        </Card>
        <Card size="sm" className="min-w-[160px] snap-start gap-2 lg:min-w-0">
          <CardHeader>
            <span className="flex items-center gap-2">
              <IconTile
                variant="soft"
                size="sm"
                className="text-accent-foreground"
              >
                <Users />
              </IconTile>
              <span className="text-sm font-medium text-muted-foreground">
                Korban
              </span>
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            <span className={numberClass}>
              {totalVictims.toLocaleString("id-ID")}
            </span>
            <Badge variant="secondary" size="sm" radius="full">
              jiwa terdampak
            </Badge>
          </CardContent>
        </Card>
        <Card size="sm" className="min-w-[160px] snap-start gap-2 lg:min-w-0">
          <CardHeader>
            <span className="flex items-center gap-2">
              <IconTile variant="soft" size="sm" className="text-destructive">
                <Siren />
              </IconTile>
              <span className="text-sm font-medium text-muted-foreground">
                Hari keracunan
              </span>
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            <span className={numberClass}>
              {poisonedDays.toLocaleString("id-ID")}
            </span>
            <Badge variant="destructive-light" size="sm" radius="full">
              {first ? `sejak ${formatDate(first)}` : "belum ada data"}
            </Badge>
          </CardContent>
        </Card>
        <Card size="sm" className="min-w-[160px] snap-start gap-2 lg:min-w-0">
          <CardHeader>
            <span className="flex items-center gap-2">
              <IconTile variant="soft" size="sm" className="text-success">
                <ShieldCheck />
              </IconTile>
              <span className="text-sm font-medium text-muted-foreground">
                Hari tanpa keracunan
              </span>
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            <span className={numberClass}>
              {safeDays.toLocaleString("id-ID")}
            </span>
            <Badge variant="success-light" size="sm" radius="full">
              di luar hari berkasus
            </Badge>
          </CardContent>
        </Card>
      </StatsScroll>
      {footnote && (
        <p className="px-4 text-xs text-muted-foreground lg:px-0">
          *{footnote}
        </p>
      )}
    </div>
  );
}
