"use client";

import { useState } from "react";
import { deleteDoc, doc, setDoc, where } from "firebase/firestore";
import { Shell } from "@/components/Shell";
import { ErrorBanner } from "@/components/ui";
import { useCollection } from "@/lib/data";
import { db } from "@/lib/firebase";
import { errMsg } from "@/lib/errors";
import type { Attendance, AttendanceStatus, Profile } from "@/lib/types";
import { ATTENDANCE_LABEL, ATTENDANCE_STYLE, today } from "@/lib/utils";

const STATUSES = Object.keys(ATTENDANCE_LABEL) as AttendanceStatus[];
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function AttendancePage({ me }: { me: Profile }) {
  const isAdmin = me.role === "admin";
  const [month, setMonth] = useState(today().slice(0, 7));
  const [day, setDay] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth).padStart(2, "0")}`;

  const { data: people } = useCollection<Profile>("users");
  const { data: rows } = useCollection<Attendance>("attendance", [where("day", ">=", first), where("day", "<=", last)], month);
  const staff = (people ?? []).filter((p) => p.active).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const byKey = new Map((rows ?? []).map((r) => [`${r.userId}|${r.day}`, r.status]));

  async function mark(userId: string, status: AttendanceStatus | "") {
    setError(null);
    try {
      const ref = doc(db(), "attendance", `${userId}_${day}`);
      if (status) await setDoc(ref, { userId, day, status, markedBy: me.id });
      else await deleteDoc(ref);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Attendance</h1>
      <ErrorBanner error={error} />
      {isAdmin && (
        <div className="card mb-6">
          <div className="mb-3">
            <label htmlFor="day" className="label">Mark attendance for</label>
            <input id="day" type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="input w-auto" />
          </div>
          <ul className="divide-y divide-slate-100">
            {staff.map((p) => {
              const cur = byKey.get(`${p.id}|${day}`);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="w-48 text-sm">{p.fullName}</span>
                  {STATUSES.map((s) => (
                    <button key={s} onClick={() => mark(p.id, cur === s ? "" : s)}
                      className={`rounded-md border px-2 py-1 text-xs ${cur === s ? `${ATTENDANCE_STYLE[s]} border-transparent font-semibold` : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>
                      {ATTENDANCE_LABEL[s]}
                    </button>
                  ))}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Click a selected button again to clear it.{day.slice(0, 7) !== month && " The grid below shows a different month."}</p>
        </div>
      )}

      <div className="mb-2 flex items-center gap-3">
        <button className="btn-ghost" aria-label="Previous month" onClick={() => setMonth(ym(new Date(y, m - 2, 1)))}>←</button>
        <span className="font-medium">{new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" })}</span>
        <button className="btn-ghost" aria-label="Next month" onClick={() => setMonth(ym(new Date(y, m, 1)))}>→</button>
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
            {staff.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-1.5 text-sm">{p.fullName}</td>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const s = byKey.get(`${p.id}|${month}-${String(i + 1).padStart(2, "0")}`);
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

export default function Page() {
  return <Shell>{(me) => <AttendancePage me={me} />}</Shell>;
}
