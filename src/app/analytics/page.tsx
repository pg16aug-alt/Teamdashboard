"use client";

import { useState } from "react";
import { Shell } from "@/components/Shell";
import { DeliveryChart, WorkloadChart } from "@/components/Charts";
import { computeStats } from "@/lib/analytics";
import { useAllSubmissions, useCollection } from "@/lib/data";
import type { Profile, Task } from "@/lib/types";
import { today } from "@/lib/utils";

function Stat({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function Analytics() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const { data: tasks } = useCollection<Task>("tasks");
  const { data: people } = useCollection<Profile>("users");
  const subs = useAllSubmissions(true);
  if (!tasks || !people || !subs) return <p className="text-sm text-slate-500">Loading…</p>;

  const staff = people.filter((p) => p.active).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const s = computeStats(tasks, subs, staff, month);
  const pct = (n: number) => (s.completed ? `${Math.round((n / s.completed) * 100)}%` : "—");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <div>
          <label htmlFor="month" className="label">Completed in month</label>
          <input id="month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Completed" value={s.completed} />
        <Stat label="Early" value={`${s.timing.early} (${pct(s.timing.early)})`} tone="text-emerald-600" />
        <Stat label="On the deadline" value={`${s.timing.on_time} (${pct(s.timing.on_time)})`} tone="text-blue-600" />
        <Stat label="Late" value={`${s.timing.late} (${pct(s.timing.late)})`} tone="text-red-600" />
        <Stat label="Open tasks" value={s.openCount} />
        <Stat label="Overdue now" value={s.overdueOpen} tone={s.overdueOpen ? "text-red-600" : ""} />
        <Stat label="Due within 48h" value={s.dueSoon} tone={s.dueSoon ? "text-amber-600" : ""} />
        <Stat label="Avg submissions per task / first-pass approval" value={`${s.avgVersions} / ${s.firstPassRate === null ? "—" : `${s.firstPassRate}%`}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card"><h2 className="mb-2 font-semibold">Delivery by person ({month})</h2><DeliveryChart data={s.perPerson} /></div>
        <div className="card"><h2 className="mb-2 font-semibold">Current workload vs capacity</h2><WorkloadChart data={s.perPerson} /></div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Person</th><th className="px-3 py-2">Open</th><th className="px-3 py-2">Overdue</th><th className="px-3 py-2">Open est. h</th><th className="px-3 py-2">Completed</th><th className="px-3 py-2">On-time rate</th><th className="px-3 py-2">Hours logged</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {s.perPerson.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2">{p.open}</td>
                <td className={`px-3 py-2 ${p.overdue ? "font-semibold text-red-600" : ""}`}>{p.overdue}</td>
                <td className={`px-3 py-2 ${p.openEstHours > p.capacity ? "font-semibold text-red-600" : ""}`}>{Math.round(p.openEstHours * 10) / 10} / {p.capacity}</td>
                <td className="px-3 py-2">{p.completed}</td>
                <td className="px-3 py-2">{p.onTimeRate === null ? "—" : `${p.onTimeRate}%`}</td>
                <td className="px-3 py-2">{p.hoursLogged}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Early means finished at least a day before the deadline. Shared tasks count for each assignee; estimated hours are split between them.</p>
    </div>
  );
}

export default function Page() {
  return <Shell roles={["admin", "manager"]}>{() => <Analytics />}</Shell>;
}
