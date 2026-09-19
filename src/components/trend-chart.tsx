"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PeriodGroup } from "@/lib/timeline";

type Metric = "cases" | "victims";

// Solid versions of the list badges: destructive-light for cases, outline for victims.
const config: ChartConfig = {
  cases: { label: "Kasus", color: "var(--color-destructive)" },
  victims: { label: "Korban", color: "var(--color-muted-foreground)" },
};

export function TrendChart({ groups }: { groups: PeriodGroup[] }) {
  const [metric, setMetric] = useState<Metric>("cases");
  if (groups.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Belum ada data untuk ditampilkan.
      </p>
    );
  }
  // Chronological (oldest first) on the x-axis; the list view keeps newest first.
  const data = [...groups].reverse().map((g) => ({
    label: g.label,
    cases: g.cases,
    victims: g.victims,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Tren {metric === "cases" ? "kasus" : "korban"} per periode
        </p>
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
      <ChartContainer config={config} className="min-h-64 w-full">
        <BarChart data={data} margin={{ left: 0, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            width={44}
            tickFormatter={(v: number) =>
              new Intl.NumberFormat("id-ID", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(v)
            }
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.label ?? ""
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
