import { requireProfile } from "@/lib/auth";
import type { Profile, Submission, Task } from "@/lib/types";
import { computeStats } from "@/lib/analytics";
import { DeliveryChart, WorkloadChart } from "@/components/Charts";
import { today } from "@/lib/utils";

function Stat({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

export default async function Analytics({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireProfile(["admin", "manager"]);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today().slice(0, 7);
  const [{ data: tasks }, { data: subs }, { data: people }] = await Promise.all([
    supabase.from("tasks").select("*, projects(*, clients(*)), task_assignees(user_id)").returns<Task[]>(),
    supabase.from("submissions").select("*").returns<Submission[]>(),
    supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
  ]);
  const s = computeStats(tasks ?? [], subs ?? [], people ?? [], month);
  const pct = (n: number) => (s.completed ? `${Math.round((n / s.completed) * 100)}%` : "—");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <form className="flex items-end gap-2">
          <div><label className="label">Completed in month</label><input type="month" name="month" defaultValue={month} className="input" /></div>
          <button className="btn-ghost">Apply</button>
        </form>
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
