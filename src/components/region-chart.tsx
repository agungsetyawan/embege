"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  groupByRegion,
  type RegionLevel,
  type TimelineDay,
} from "@/lib/timeline";

type Metric = "cases" | "victims";

const TOP_N = 10;

// Kasus mengikuti primary hijau, korban mengikuti aksen pink.
const config: ChartConfig = {
  cases: { label: "Kasus", color: "var(--color-primary)" },
  victims: { label: "Korban", color: "var(--color-accent-foreground)" },
};

function shorten(label: string): string {
  return label.length > 24 ? `${label.slice(0, 23)}…` : label;
}

export function RegionChart({ timeline }: { timeline: TimelineDay[] }) {
  const [level, setLevel] = useState<RegionLevel>("province");
  const [metric, setMetric] = useState<Metric>("cases");

  const data = useMemo(() => {
    const groups = groupByRegion(timeline, level);
    groups.sort((a, b) => b[metric] - a[metric]);
    return groups.slice(0, TOP_N).map((g) => ({
      name: g.label,
      cases: g.cases,
      victims: g.victims,
    }));
  }, [timeline, level, metric]);

  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Belum ada data untuk ditampilkan.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={level}
          onValueChange={(v) => setLevel(v as RegionLevel)}
          aria-label="Pilih level wilayah"
        >
          <TabsList>
            <TabsTrigger value="province">Provinsi</TabsTrigger>
            <TabsTrigger value="district">Kabupaten/Kota</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs
          value={metric}
          onValueChange={(v) => setMetric(v as Metric)}
          aria-label="Pilih metrik grafik"
        >
          <TabsList>
            <TabsTrigger value="cases">Kasus</TabsTrigger>
            <TabsTrigger value="victims">Korban</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <p className="text-sm text-muted-foreground">
        {TOP_N} {level === "province" ? "provinsi" : "kabupaten/kota"} teratas
        berdasarkan {metric === "cases" ? "kasus" : "korban"}
      </p>
      <ChartContainer config={config} className="min-h-80 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8 }}>
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) =>
              new Intl.NumberFormat("id-ID", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(v)
            }
          />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            width={140}
            tickFormatter={shorten}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.name ?? ""
                }
                formatter={(value) => (
                  <span className="tabular-nums">
                    {Number(value).toLocaleString("id-ID")}{" "}
                    {metric === "cases" ? "kasus" : "korban"}
                  </span>
                )}
              />
            }
          />
          <Bar dataKey={metric} fill={`var(--color-${metric})`} radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
