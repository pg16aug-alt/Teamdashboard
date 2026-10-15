"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PersonStats } from "@/lib/analytics";

const C = { early: "#10b981", onTime: "#3b82f6", late: "#ef4444", load: "#6366f1", cap: "#cbd5e1" };

export function DeliveryChart({ data }: { data: PersonStats[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={12} />
        <YAxis allowDecimals={false} fontSize={12} />
        <Tooltip />
        <Legend />
        <Bar isAnimationActive={false} dataKey="early" name="Early" stackId="a" fill={C.early} />
        <Bar isAnimationActive={false} dataKey="onTime" name="On time" stackId="a" fill={C.onTime} />
        <Bar isAnimationActive={false} dataKey="late" name="Late" stackId="a" fill={C.late} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WorkloadChart({ data }: { data: PersonStats[] }) {
  const rows = data.map((d) => ({ ...d, openEstHours: Math.round(d.openEstHours * 10) / 10 }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Legend />
        <Bar isAnimationActive={false} dataKey="openEstHours" name="Open work (est. hours)" fill={C.load} />
        <Bar isAnimationActive={false} dataKey="capacity" name="Weekly capacity (h)" fill={C.cap} />
      </BarChart>
    </ResponsiveContainer>
  );
}
