import { requireProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import { createTask } from "@/app/actions";
import { today } from "@/lib/utils";

export default async function NewTask({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireProfile(["admin", "manager"]);
  const [{ data: projects }, { data: people }, { data: attendance }] = await Promise.all([
    supabase.from("projects").select("id, name, clients(name)").eq("active", true).order("name"),
    supabase.from("profiles").select("*").eq("active", true).order("full_name").returns<Profile[]>(),
    supabase.from("attendance").select("user_id, status").eq("day", today()),
  ]);
  const away = new Map((attendance ?? []).filter((a) => a.status === "absent" || a.status === "leave").map((a) => [a.user_id, a.status]));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">New task</h1>
      <ErrorBanner error={sp.error} />
      <form action={createTask} className="card space-y-4">
        <div>
          <label className="label">Client / project</label>
          <select name="project_id" required className="input">
            {(projects ?? []).map((p) => {
              const c = p.clients as unknown as { name: string } | null;
              return <option key={p.id} value={p.id}>{c?.name} — {p.name}</option>;
            })}
          </select>
          {(projects ?? []).length === 0 && <p className="mt-1 text-xs text-amber-700">Add a client and project first (Clients page).</p>}
        </div>
        <div>
          <label className="label">Title</label>
          <input name="title" required className="input" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea name="description" rows={3} className="input" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Deadline</label><input name="deadline" type="date" required defaultValue={today()} className="input" /></div>
          <div>
            <label className="label">Priority</label>
            <select name="priority" defaultValue="medium" className="input">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
          <div><label className="label">Estimated hours</label><input name="estimated_hours" type="number" min="0" step="0.5" className="input" /></div>
        </div>
        <fieldset>
          <legend className="label">Assignees (one or more)</legend>
          <div className="grid grid-cols-2 gap-1">
            {(people ?? []).map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="assignees" value={p.id} />
                {p.full_name}
                {away.has(p.id) && <span className="rounded bg-red-100 px-1 text-xs text-red-700">{away.get(p.id) === "leave" ? "on leave today" : "absent today"}</span>}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label">Reviewer (optional: leave empty if no hand-off is needed)</label>
          <select name="reviewer_id" className="input">
            <option value="">No review needed</option>
            {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <button className="btn">Create task</button>
      </form>
    </div>
  );
}
