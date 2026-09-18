import { FileText, ShieldCheck, Users } from "lucide-react";
import { Alert, AlertTitle } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import { IconTile } from "@/components/reui/icon-tile";
import { StatsCardsDialog } from "@/components/stats-cards-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { buildFootnote, countSafeDays } from "@/lib/timeline";
import { fetchTimeline } from "@/lib/timeline-data";

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
    "text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl";

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Card size="sm" className="gap-2">
          <CardHeader>
            <span className="flex items-center gap-2">
              <IconTile variant="soft" size="sm" className="text-info">
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
            <Badge variant="info-light" size="sm" radius="full">
              laporan terkurasi
            </Badge>
          </CardContent>
        </Card>
        <Card size="sm" className="gap-2">
          <CardHeader>
            <span className="flex items-center gap-2">
              <IconTile variant="soft" size="sm" className="text-warning">
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
            <Badge variant="warning-light" size="sm" radius="full">
              jiwa terdampak
            </Badge>
          </CardContent>
        </Card>
        <StatsCardsDialog
          timeline={timeline}
          first={first}
          poisonedDays={poisonedDays}
        />
        <Card size="sm" className="gap-2">
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
      </div>
      {footnote && <p className="text-xs text-muted-foreground">*{footnote}</p>}
    </div>
  );
}
