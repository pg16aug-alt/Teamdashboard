"use client";

import Link from "next/link";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { ClientBadge, FlagPill, StatusPill } from "@/components/ui";
import { useCollection } from "@/lib/data";
import type { Client, Profile, Task, TaskStatus } from "@/lib/types";
import { PRIORITY_STYLE, STATUS_LABEL, fmtDate, taskFlag } from "@/lib/utils";

function Board({ me }: { me: Profile }) {
  const { data: tasks } = useCollection<Task>("tasks");
  const { data: people } = useCollection<Profile>("users");
  const { data: clients } = useCollection<Client>("clients");
  const [f, setF] = useState({ client: "", person: "", status: "", mine: false });

  const active = (people ?? []).filter((p) => p.active);
  const name = new Map((people ?? []).map((p) => [p.id, p.fullName]));
  const logo = new Map((clients ?? []).map((c) => [c.id, c.logoUrl]));
  const rows = (tasks ?? [])
    .filter((t) => {
      if (f.client && t.clientId !== f.client) return false;
      if (f.person && !t.assigneeIds.includes(f.person)) return false;
      if (f.mine && !t.assigneeIds.includes(me.id)) return false;
      if (f.status === "open" ? t.status === "done" : f.status && t.status !== f.status) return false;
      return true;
    })
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Tasks</h1>
        {me.role !== "employee" && <Link href="/tasks/new" className="btn">New task</Link>}
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="client" className="label">Client</label>
          <select id="client" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} className="input">
            <option value="">All</option>
            {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="person" className="label">Person</label>
          <select id="person" value={f.person} onChange={(e) => setF({ ...f, person: e.target.value })} className="input">
            <option value="">Everyone</option>
            {active.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="input">
            <option value="">All</option>
            <option value="open">Open (not done)</option>
            {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={f.mine} onChange={(e) => setF({ ...f, mine: e.target.checked })} /> Only mine
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Client / project</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Working on it</th>
              <th className="px-3 py-2">Deadline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <ClientBadge name={t.clientName} logoUrl={logo.get(t.clientId)} />
                  <div className="ml-8 text-xs text-slate-500">{t.projectName}</div>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/task?id=${t.id}`} className="font-medium text-blue-700 hover:underline">{t.title}</Link>
                  <span className={`ml-2 text-xs ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
                </td>
                <td className="px-3 py-2"><StatusPill status={t.status} /></td>
                <td className="px-3 py-2">{t.assigneeIds.map((id) => name.get(id) ?? "?").join(", ")}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(t.deadline)} <FlagPill flag={taskFlag(t)} /></td>
              </tr>
            ))}
            {tasks && rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No tasks match.</td></tr>}
            {!tasks && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Loading…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page() {
  return <Shell>{(me) => <Board me={me} />}</Shell>;
}
