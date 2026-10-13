import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import type { Profile, Submission, Task } from "@/lib/types";
import { ClientBadge, ErrorBanner, FlagPill, StatusPill } from "@/components/ui";
import { reviewSubmission, setProgress, submitWork } from "@/app/actions";
import { completionTiming, fmtDate, taskFlag } from "@/lib/utils";

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile();
  const { data: task } = await supabase
    .from("tasks")
    .select("*, projects(*, clients(*)), task_assignees(user_id)")
    .eq("id", id)
    .maybeSingle<Task>();
  if (!task) notFound();
  const [{ data: subs }, { data: people }] = await Promise.all([
    supabase.from("submissions").select("*").eq("task_id", id).order("version").returns<Submission[]>(),
    supabase.from("profiles").select("id, full_name").returns<Pick<Profile, "id" | "full_name">[]>(),
  ]);
  const name = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const isAssignee = task.task_assignees.some((a) => a.user_id === profile.id);
  const isManager = profile.role !== "employee";
  const isReviewer = task.reviewer_id === profile.id || profile.role === "admin";
  const done = task.status === "done";
  const totalHours = (subs ?? []).reduce((s, x) => s + Number(x.hours_spent), 0);
  const pending = (subs ?? []).filter((s) => s.review === "pending");
  const timing = completionTiming(task);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ErrorBanner error={sp.error} />
      <div className="card">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <ClientBadge client={task.projects.clients} />
          <span className="text-sm text-slate-500">{task.projects.name}</span>
        </div>
        <h1 className="text-xl font-semibold">{task.title}</h1>
        {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{task.description}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="label">Status</dt><dd><StatusPill status={task.status} /></dd></div>
          <div><dt className="label">Deadline</dt><dd>{fmtDate(task.deadline)} <FlagPill flag={taskFlag(task)} /></dd></div>
          <div><dt className="label">Hours logged / est.</dt><dd>{totalHours} / {task.estimated_hours ?? "—"}</dd></div>
          <div><dt className="label">Priority</dt><dd className="capitalize">{task.priority}</dd></div>
          <div className="col-span-2"><dt className="label">Working on it</dt><dd>{task.task_assignees.map((a) => name.get(a.user_id)).join(", ")}</dd></div>
          <div className="col-span-2"><dt className="label">Reviewer</dt><dd>{task.reviewer_id ? name.get(task.reviewer_id) : "No review needed"}</dd></div>
        </dl>
        {done && (
          <p className="mt-3 text-sm text-emerald-700">
            Completed {fmtDate(task.completed_at)}
            {timing && ` (${timing === "early" ? "ahead of deadline" : timing === "on_time" ? "on the deadline" : "after the deadline"})`}
          </p>
        )}
        {isAssignee && (task.status === "todo" || task.status === "in_progress") && (
          <form action={setProgress} className="mt-3">
            <input type="hidden" name="task_id" value={task.id} />
            <input type="hidden" name="started" value={task.status === "todo" ? "1" : "0"} />
            <button className="btn-ghost">{task.status === "todo" ? "Start working" : "Move back to To do"}</button>
          </form>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Drafts and submissions</h2>
        {(subs ?? []).length === 0 && <p className="text-sm text-slate-500">Nothing submitted yet.</p>}
        <ol className="space-y-3">
          {(subs ?? []).map((s) => (
            <li key={s.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">v{s.version}</span>
                <span className={`rounded px-1.5 text-xs ${s.is_final ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{s.is_final ? "Final" : "Draft"}</span>
                {s.review && (
                  <span className={`rounded px-1.5 text-xs ${s.review === "approved" ? "bg-emerald-100 text-emerald-800" : s.review === "pending" ? "bg-violet-100 text-violet-800" : "bg-amber-100 text-amber-800"}`}>
                    {s.review === "changes_requested" ? "changes requested" : s.review}
                  </span>
                )}
                <span className="text-slate-500">by {name.get(s.submitted_by)} · {fmtDate(s.submitted_at)} · {s.hours_spent}h</span>
              </div>
              <a href={s.link} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-blue-700 hover:underline">{s.link}</a>
              {s.note && <p className="mt-1 text-slate-700">{s.note}</p>}
              {s.review_note && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-slate-700">Reviewer: {s.review_note}</p>}
            </li>
          ))}
        </ol>

        {isReviewer && pending.map((ps) => (
          <form key={ps.id} action={reviewSubmission} className="mt-4 space-y-2 rounded-md bg-violet-50 p-3">
            <input type="hidden" name="task_id" value={task.id} />
            <input type="hidden" name="submission_id" value={ps.id} />
            <p className="text-sm font-medium">Review v{ps.version} ({ps.is_final ? "final" : "draft"})</p>
            <textarea name="note" rows={2} aria-label={`Feedback on v${ps.version}`} placeholder="Feedback (required if requesting changes)" className="input" />
            <div className="flex gap-2">
              <button name="decision" value="approve" className="btn">Approve</button>
              <button name="decision" value="changes" className="btn-ghost">Request changes</button>
            </div>
          </form>
        ))}

        {(isAssignee || isManager) && !done && task.status !== "in_review" && (
          <form action={submitWork} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
            <input type="hidden" name="task_id" value={task.id} />
            <p className="text-sm font-medium">Submit a draft or the final version</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="link-google-drive-et" className="label">Link (Google Drive etc.)</label>
                <input id="link-google-drive-et" name="link" type="url" required placeholder="https://drive.google.com/..." className="input" />
              </div>
              <div>
                <label htmlFor="hours-spent-on-this-" className="label">Hours spent on this version</label>
                <input id="hours-spent-on-this-" name="hours_spent" type="number" min="0.25" step="0.25" required className="input" />
              </div>
            </div>
            <div><label htmlFor="note" className="label">Note</label><input id="note" name="note" className="input" /></div>
            <div className="flex gap-2">
              <button name="kind" value="draft" className="btn-ghost">Submit draft</button>
              <button name="kind" value="final" className="btn">{task.reviewer_id ? "Submit final for review" : "Submit final and complete"}</button>
            </div>
            {task.status === "changes_requested" && <p className="text-xs text-amber-700">Changes were requested. Submit a new version when ready.</p>}
          </form>
        )}
        {task.status === "in_review" && !isReviewer && <p className="mt-3 text-sm text-violet-700">Waiting for {name.get(task.reviewer_id ?? "")} to review.</p>}
      </div>
    </div>
  );
}
