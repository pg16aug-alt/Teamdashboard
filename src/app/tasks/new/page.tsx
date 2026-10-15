"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addDoc, collection, serverTimestamp, where } from "firebase/firestore";
import { Shell } from "@/components/Shell";
import { ErrorBanner } from "@/components/ui";
import { useCollection } from "@/lib/data";
import { db } from "@/lib/firebase";
import { errMsg } from "@/lib/errors";
import type { Attendance, Client, Profile, Project } from "@/lib/types";
import { today } from "@/lib/utils";

function NewTask({ me }: { me: Profile }) {
  const router = useRouter();
  const { data: projects } = useCollection<Project>("projects");
  const { data: clients } = useCollection<Client>("clients");
  const { data: people } = useCollection<Profile>("users");
  const day = today();
  const { data: att } = useCollection<Attendance>("attendance", [where("day", "==", day)], day);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const staff = (people ?? []).filter((p) => p.active).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const away = new Map((att ?? []).filter((a) => a.status === "absent" || a.status === "leave").map((a) => [a.userId, a.status]));
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const assigneeIds = f.getAll("assignees").map(String);
    if (assigneeIds.length === 0) return setError("Pick at least one assignee");
    const project = (projects ?? []).find((p) => p.id === f.get("projectId"));
    if (!project) return setError("Pick a project");
    const est = String(f.get("estimatedHours") ?? "");
    setBusy(true);
    setError(null);
    try {
      const ref = await addDoc(collection(db(), "tasks"), {
        projectId: project.id,
        projectName: project.name,
        clientId: project.clientId,
        clientName: clientName.get(project.clientId) ?? "",
        title: String(f.get("title")).trim(),
        description: String(f.get("description") ?? "").trim() || null,
        status: "todo",
        priority: String(f.get("priority")),
        deadline: String(f.get("deadline")),
        estimatedHours: est ? Number(est) : null,
        reviewerId: String(f.get("reviewerId") ?? "") || null,
        assigneeIds,
        submissionCount: 0,
        reviewSub: null,
        completedAt: null,
        createdBy: me.id,
        createdAt: serverTimestamp(),
      });
      router.push(`/task?id=${ref.id}`);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">New task</h1>
      <ErrorBanner error={error} />
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label htmlFor="projectId" className="label">Client / project</label>
          <select id="projectId" name="projectId" required className="input">
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{clientName.get(p.clientId)} — {p.name}</option>)}
          </select>
          {projects && projects.length === 0 && <p className="mt-1 text-xs text-amber-700">Add a client and project first (Clients page).</p>}
        </div>
        <div><label htmlFor="title" className="label">Title</label><input id="title" name="title" required className="input" /></div>
        <div><label htmlFor="description" className="label">Description</label><textarea id="description" name="description" rows={3} className="input" /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label htmlFor="deadline" className="label">Deadline</label><input id="deadline" name="deadline" type="date" required defaultValue={day} className="input" /></div>
          <div>
            <label htmlFor="priority" className="label">Priority</label>
            <select id="priority" name="priority" defaultValue="medium" className="input">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
          <div><label htmlFor="estimatedHours" className="label">Estimated hours</label><input id="estimatedHours" name="estimatedHours" type="number" min="0" step="0.5" className="input" /></div>
        </div>
        <fieldset>
          <legend className="label">Assignees (one or more)</legend>
          <div className="grid grid-cols-2 gap-1">
            {staff.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="assignees" value={p.id} />
                {p.fullName}
                {away.has(p.id) && <span className="rounded bg-red-100 px-1 text-xs text-red-700">{away.get(p.id) === "leave" ? "on leave today" : "absent today"}</span>}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="reviewerId" className="label">Reviewer (optional: leave empty if no hand-off is needed)</label>
          <select id="reviewerId" name="reviewerId" className="input">
            <option value="">No review needed</option>
            {staff.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
        </div>
        <button className="btn" disabled={busy}>Create task</button>
      </form>
    </div>
  );
}

export default function Page() {
  return <Shell roles={["admin", "manager"]}>{(me) => <NewTask me={me} />}</Shell>;
}
