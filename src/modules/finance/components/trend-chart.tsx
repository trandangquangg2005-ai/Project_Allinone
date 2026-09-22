"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCompactVND, formatVND } from "@/lib/money";

const config = {
  income: { label: "Thu", color: "var(--chart-2)" },
  expense: { label: "Chi", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function TrendChart({ data }: { data: { month: string; income: number; expense: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: `T${Number(d.month.slice(5))}` }));
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart data={rows} barGap={4} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => formatCompactVND(v)} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", radius: 8 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const month = payload?.[0]?.payload?.month as string | undefined;
                return month ? `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}` : "";
              }}
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{config[name as keyof typeof config]?.label}</span>
                  <span className="tabular font-semibold">{formatVND(Number(value))}</span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="income" fill="var(--color-income)" radius={[6, 6, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={[6, 6, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  );
}
