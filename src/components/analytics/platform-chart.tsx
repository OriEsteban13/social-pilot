"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function PlatformChart({ data }: { data: { platform: string; impressions: number; engagement: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="platform" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} />
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12 }}
        />
        <Bar dataKey="impressions" fill="var(--chart-1)" radius={4} name="Impresiones" />
        <Bar dataKey="engagement" fill="var(--chart-2)" radius={4} name="Interacciones" />
      </BarChart>
    </ResponsiveContainer>
  );
}
