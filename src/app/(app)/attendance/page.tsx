import { requireProfile } from "@/lib/auth";
import type { AttendanceStatus, Profile } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import { markAttendance } from "@/app/actions";
import { ATTENDANCE_LABEL, ATTENDANCE_STYLE, today } from "@/lib/utils";

const STATUSES = Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[];

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ month?: string; day?: string; error?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  const isAdmin = profile.role === "admin";
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? "") ? sp.day! : today();

  const [{ data: people }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name").returns<Pick<Profile, "id" | "full_name">[]>(),
    supabase.from("attendance").select("user_id, day, status").gte("day", first).lte("day", last),
  ]);
  const byKey = new Map((rows ?? []).map((r) => [`${r.user_id}|${r.day}`, r.status as AttendanceStatus]));
  const prev = new Date(y, m - 2, 1);
  const next = new Date(y, m, 1);
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Attendance</h1>
      <ErrorBanner error={sp.error} />

      {isAdmin && (
        <div className="card mb-6">
          <form className="mb-3 flex items-end gap-3">
            <div><label className="label">Mark attendance for</label><input type="date" name="day" defaultValue={day} className="input" /></div>
            <button className="btn-ghost">Go</button>
          </form>
          <ul className="divide-y divide-slate-100">
            {(people ?? []).map((p) => {
              const cur = byKey.get(`${p.id}|${day}`);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="w-48 text-sm">{p.full_name}</span>
                  {STATUSES.map((s) => (
                    <form key={s} action={markAttendance}>
                      <input type="hidden" name="user_id" value={p.id} />
                      <input type="hidden" name="day" value={day} />
                      <input type="hidden" name="status" value={cur === s ? "" : s} />
                      <button className={`rounded-md border px-2 py-1 text-xs ${cur === s ? `${ATTENDANCE_STYLE[s]} border-transparent font-semibold` : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>
                        {ATTENDANCE_LABEL[s]}
                      </button>
                    </form>
                  ))}
                </li>
              );
            })}
          </ul>
          {day !== today() && <p className="mt-2 text-xs text-slate-500">Marking {day}. Click a selected button again to clear it.</p>}
        </div>
      )}

      <div className="mb-2 flex items-center gap-3">
        <a className="btn-ghost" href={`?month=${ym(prev)}`}>←</a>
        <span className="font-medium">{new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" })}</span>
        <a className="btn-ghost" href={`?month=${ym(next)}`}>→</a>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left">Person</th>
              {Array.from({ length: daysInMonth }, (_, i) => <th key={i} className="px-1.5 py-2 text-center font-normal text-slate-500">{i + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {(people ?? []).map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-1.5 text-sm">{p.full_name}</td>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = `${month}-${String(i + 1).padStart(2, "0")}`;
                  const s = byKey.get(`${p.id}|${d}`);
                  return (
                    <td key={i} className="px-0.5 py-1 text-center">
                      {s ? <span title={ATTENDANCE_LABEL[s]} className={`inline-block w-6 rounded py-0.5 font-medium ${ATTENDANCE_STYLE[s]}`}>{s === "half_day" ? "H" : s[0].toUpperCase()}</span> : <span className="text-slate-300">·</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">P = present, A = absent, H = half day, L = leave.</p>
    </div>
  );
}
