import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import type { Profile, Task, TaskStatus } from "@/lib/types";
import { ClientBadge, ErrorBanner, FlagPill, StatusPill } from "@/components/ui";
import { PRIORITY_STYLE, STATUS_LABEL, fmtDate, taskFlag } from "@/lib/utils";

type Search = { client?: string; person?: string; status?: string; mine?: string; error?: string };

export default async function TaskBoard({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  const [{ data: tasks }, { data: people }, { data: clients }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, projects(*, clients(*)), task_assignees(user_id)")
      .order("deadline")
      .returns<Task[]>(),
    supabase.from("profiles").select("id, full_name").eq("active", true).returns<Pick<Profile, "id" | "full_name">[]>(),
    supabase.from("clients").select("id, name").eq("active", true).order("name"),
  ]);
  const name = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const canCreate = profile.role !== "employee";

  const rows = (tasks ?? []).filter((t) => {
    if (sp.client && t.projects.client_id !== sp.client) return false;
    if (sp.person && !t.task_assignees.some((a) => a.user_id === sp.person)) return false;
    if (sp.mine && !t.task_assignees.some((a) => a.user_id === profile.id)) return false;
    if (sp.status === "open" ? t.status === "done" : sp.status && t.status !== sp.status) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Tasks</h1>
        {canCreate && <Link href="/tasks/new" className="btn">New task</Link>}
      </div>
      <ErrorBanner error={sp.error} />
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="client" className="label">Client</label>
          <select id="client" name="client" defaultValue={sp.client ?? ""} className="input">
            <option value="">All</option>
            {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="person" className="label">Person</label>
          <select id="person" name="person" defaultValue={sp.person ?? ""} className="input">
            <option value="">Everyone</option>
            {people?.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">All</option>
            <option value="open">Open (not done)</option>
            {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="mine" value="1" defaultChecked={!!sp.mine} /> Only mine
        </label>
        <button className="btn-ghost">Filter</button>
      </form>

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
                  <ClientBadge client={t.projects.clients} />
                  <div className="ml-8 text-xs text-slate-500">{t.projects.name}</div>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/tasks/${t.id}`} className="font-medium text-blue-700 hover:underline">{t.title}</Link>
                  <span className={`ml-2 text-xs ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
                </td>
                <td className="px-3 py-2"><StatusPill status={t.status} /></td>
                <td className="px-3 py-2">{t.task_assignees.map((a) => name.get(a.user_id) ?? "?").join(", ")}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtDate(t.deadline)} <FlagPill flag={taskFlag(t)} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No tasks match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
