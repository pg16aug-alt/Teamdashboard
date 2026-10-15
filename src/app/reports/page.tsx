"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { ErrorBanner } from "@/components/ui";
import { fetchSubmissions, useCollection } from "@/lib/data";
import { errMsg } from "@/lib/errors";
import type { Client, Task } from "@/lib/types";
import { completionTiming, fmtDate, today } from "@/lib/utils";

interface Row { project: string; title: string; deadline: string; completed: string; result: string; hours: number; link: string }
const RESULT = { early: "Ahead of deadline", on_time: "On the deadline", late: "Late" } as const;

function Reports() {
  const { data: clients } = useCollection<Client>("clients");
  const { data: tasks } = useCollection<Task>("tasks");
  const [clientId, setClientId] = useState("");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId || !tasks) return setRows(null);
    let cancelled = false;
    const done = tasks
      .filter((t) => t.clientId === clientId && t.status === "done" && t.completedAt?.slice(0, 7) === month)
      .sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? ""));
    Promise.all(
      done.map(async (t): Promise<Row> => {
        const subs = await fetchSubmissions(t.id);
        const final = [...subs].reverse().find((s) => s.isFinal && s.review === "approved");
        const k = completionTiming(t);
        return {
          project: t.projectName, title: t.title, deadline: t.deadline, completed: (t.completedAt ?? "").slice(0, 10),
          result: k ? RESULT[k] : "", hours: subs.reduce((a, s) => a + Number(s.hoursSpent), 0), link: final?.link ?? "",
        };
      }),
    )
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setError(errMsg(e)));
    return () => { cancelled = true; };
  }, [clientId, month, tasks]);

  async function download() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(month);
    ws.columns = [
      { header: "Project", key: "project", width: 24 }, { header: "Deliverable", key: "title", width: 40 },
      { header: "Deadline", key: "deadline", width: 14 }, { header: "Completed", key: "completed", width: 14 },
      { header: "Result", key: "result", width: 20 }, { header: "Hours", key: "hours", width: 8 }, { header: "Link", key: "link", width: 60 },
    ];
    ws.getRow(1).font = { bold: true };
    (rows ?? []).forEach((r) => {
      const row = ws.addRow(r);
      if (r.link) row.getCell("link").value = { text: r.link, hyperlink: r.link };
    });
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const cname = (clients ?? []).find((c) => c.id === clientId)?.name ?? "client";
    a.download = `${cname.replace(/[^\w-]+/g, "_")}_${month}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Client month-end report</h1>
      <ErrorBanner error={error} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="client" className="label">Client</label>
          <select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
            <option value="">Select…</option>
            {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="month" className="label">Month</label>
          <input id="month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="input" />
        </div>
        {rows && <button className="btn" onClick={() => download().catch((e) => setError(errMsg(e)))}>Download Excel</button>}
      </div>

      {clientId && !rows && <p className="text-sm text-slate-500">Loading…</p>}
      {rows && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-2">Project</th><th className="px-3 py-2">Deliverable</th><th className="px-3 py-2">Deadline</th><th className="px-3 py-2">Completed</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">Link</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{r.project}</td><td className="px-3 py-2 font-medium">{r.title}</td>
                  <td className="px-3 py-2">{fmtDate(r.deadline)}</td><td className="px-3 py-2">{fmtDate(r.completed)}</td>
                  <td className="px-3 py-2">{r.result}</td>
                  <td className="px-3 py-2">{r.link && <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">Open</a>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Nothing completed for this client in {month}.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return <Shell roles={["admin", "manager"]}>{() => <Reports />}</Shell>;
}
