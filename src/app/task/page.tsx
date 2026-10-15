"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { doc, onSnapshot, orderBy, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { Shell } from "@/components/Shell";
import { ClientBadge, ErrorBanner, FlagPill, StatusPill } from "@/components/ui";
import { plain, useCollection } from "@/lib/data";
import { db } from "@/lib/firebase";
import { errMsg } from "@/lib/errors";
import type { Profile, Submission, Task } from "@/lib/types";
import { completionTiming, fmtDate, taskFlag } from "@/lib/utils";

function TaskView({ me, id }: { me: Profile; id: string }) {
  const [task, setTask] = useState<Task | null | undefined>(undefined);
  const { data: subs } = useCollection<Submission>(`tasks/${id}/submissions`, [orderBy("version")]);
  const { data: people } = useCollection<Profile>("users");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(
    () => onSnapshot(doc(db(), "tasks", id), (s) => setTask(s.exists() ? plain<Task>(s.id, s.data()) : null), () => setTask(null)),
    [id],
  );

  if (task === undefined) return <p className="text-sm text-slate-500">Loading…</p>;
  if (task === null) return <p className="text-sm text-slate-500">Task not found.</p>;

  const name = new Map((people ?? []).map((p) => [p.id, p.fullName]));
  const isAssignee = task.assigneeIds.includes(me.id);
  const isManager = me.role !== "employee";
  const isReviewer = task.reviewerId === me.id || me.role === "admin";
  const done = task.status === "done";
  const list = subs ?? [];
  const totalHours = list.reduce((s, x) => s + Number(x.hoursSpent), 0);
  const pending = list.filter((s) => s.review === "pending");
  const timing = completionTiming(task);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errMsg(err));
    }
    setBusy(false);
  }

  const setProgress = (started: boolean) => run(() => updateDoc(doc(db(), "tasks", id), { status: started ? "in_progress" : "todo" }));

  function submitWork(e: React.FormEvent<HTMLFormElement>, isFinal: boolean) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const t = task!;
    return run(async () => {
      const n = t.submissionCount + 1;
      const noReview = t.reviewerId === null;
      const toDone = isFinal && noReview;
      const batch = writeBatch(db());
      batch.set(doc(db(), "tasks", id, "submissions", `v${n}`), {
        version: n,
        link: String(f.get("link")).trim(),
        hoursSpent: Number(f.get("hoursSpent")),
        note: String(f.get("note") ?? "").trim() || null,
        isFinal,
        submittedBy: me.id,
        submittedAt: serverTimestamp(),
        review: noReview ? (isFinal ? "approved" : null) : "pending",
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
      });
      batch.update(doc(db(), "tasks", id), {
        submissionCount: n,
        status: toDone ? "done" : noReview ? "in_progress" : "in_review",
        ...(toDone ? { completedAt: serverTimestamp() } : {}),
      });
      await batch.commit();
      form.reset();
    });
  }

  function review(form: HTMLFormElement, s: Submission, approve: boolean) {
    const note = String(new FormData(form).get("note") ?? "").trim();
    if (!approve && !note) return setError("Add a note explaining what needs to change");
    return run(async () => {
      const toDone = approve && s.isFinal;
      const batch = writeBatch(db());
      batch.update(doc(db(), "tasks", id, "submissions", s.id), {
        review: approve ? "approved" : "changes_requested",
        reviewNote: note || null,
        reviewedBy: me.id,
        reviewedAt: serverTimestamp(),
      });
      batch.update(doc(db(), "tasks", id), {
        reviewSub: s.id,
        status: !approve ? "changes_requested" : s.isFinal ? "done" : "in_progress",
        ...(toDone ? { completedAt: serverTimestamp() } : {}),
      });
      await batch.commit();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ErrorBanner error={error} />
      <div className="card">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <ClientBadge name={task.clientName} />
          <span className="text-sm text-slate-500">{task.projectName}</span>
        </div>
        <h1 className="text-xl font-semibold">{task.title}</h1>
        {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{task.description}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="label">Status</dt><dd><StatusPill status={task.status} /></dd></div>
          <div><dt className="label">Deadline</dt><dd>{fmtDate(task.deadline)} <FlagPill flag={taskFlag(task)} /></dd></div>
          <div><dt className="label">Hours logged / est.</dt><dd>{totalHours} / {task.estimatedHours ?? "—"}</dd></div>
          <div><dt className="label">Priority</dt><dd className="capitalize">{task.priority}</dd></div>
          <div className="col-span-2"><dt className="label">Working on it</dt><dd>{task.assigneeIds.map((a) => name.get(a)).join(", ")}</dd></div>
          <div className="col-span-2"><dt className="label">Reviewer</dt><dd>{task.reviewerId ? name.get(task.reviewerId) : "No review needed"}</dd></div>
        </dl>
        {done && (
          <p className="mt-3 text-sm text-emerald-700">
            Completed {fmtDate(task.completedAt)}
            {timing && ` (${timing === "early" ? "ahead of deadline" : timing === "on_time" ? "on the deadline" : "after the deadline"})`}
          </p>
        )}
        {isAssignee && (task.status === "todo" || task.status === "in_progress") && (
          <button className="btn-ghost mt-3" disabled={busy} onClick={() => setProgress(task.status === "todo")}>
            {task.status === "todo" ? "Start working" : "Move back to To do"}
          </button>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Drafts and submissions</h2>
        {list.length === 0 && <p className="text-sm text-slate-500">Nothing submitted yet.</p>}
        <ol className="space-y-3">
          {list.map((s) => (
            <li key={s.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">v{s.version}</span>
                <span className={`rounded px-1.5 text-xs ${s.isFinal ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{s.isFinal ? "Final" : "Draft"}</span>
                {s.review && (
                  <span className={`rounded px-1.5 text-xs ${s.review === "approved" ? "bg-emerald-100 text-emerald-800" : s.review === "pending" ? "bg-violet-100 text-violet-800" : "bg-amber-100 text-amber-800"}`}>
                    {s.review === "changes_requested" ? "changes requested" : s.review}
                  </span>
                )}
                <span className="text-slate-500">by {name.get(s.submittedBy)} · {fmtDate(s.submittedAt)} · {s.hoursSpent}h</span>
              </div>
              <a href={s.link} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-blue-700 hover:underline">{s.link}</a>
              {s.note && <p className="mt-1 text-slate-700">{s.note}</p>}
              {s.reviewNote && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-slate-700">Reviewer: {s.reviewNote}</p>}
            </li>
          ))}
        </ol>

        {isReviewer && pending.map((ps) => (
          <form key={ps.id} onSubmit={(e) => { e.preventDefault(); review(e.currentTarget, ps, true); }} className="mt-4 space-y-2 rounded-md bg-violet-50 p-3">
            <p className="text-sm font-medium">Review v{ps.version} ({ps.isFinal ? "final" : "draft"})</p>
            <textarea name="note" rows={2} aria-label={`Feedback on v${ps.version}`} placeholder="Feedback (required if requesting changes)" className="input" />
            <div className="flex gap-2">
              <button className="btn" disabled={busy}>Approve</button>
              <button type="button" className="btn-ghost" disabled={busy}
                onClick={(e) => review(e.currentTarget.form!, ps, false)}>
                Request changes
              </button>
            </div>
          </form>
        ))}

        {(isAssignee || isManager) && !done && task.status !== "in_review" && (
          <form onSubmit={(e) => submitWork(e, (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "final")} className="mt-4 space-y-3 border-t border-slate-200 pt-4">
            <p className="text-sm font-medium">Submit a draft or the final version</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="link" className="label">Link (Google Drive etc.)</label>
                <input id="link" name="link" type="url" required placeholder="https://drive.google.com/..." className="input" />
              </div>
              <div>
                <label htmlFor="hoursSpent" className="label">Hours spent on this version</label>
                <input id="hoursSpent" name="hoursSpent" type="number" min="0.25" step="0.25" required className="input" />
              </div>
            </div>
            <div><label htmlFor="note" className="label">Note</label><input id="note" name="note" className="input" /></div>
            <div className="flex gap-2">
              <button name="kind" value="draft" className="btn-ghost" disabled={busy}>Submit draft</button>
              <button name="kind" value="final" className="btn" disabled={busy}>{task.reviewerId ? "Submit final for review" : "Submit final and complete"}</button>
            </div>
            {task.status === "changes_requested" && <p className="text-xs text-amber-700">Changes were requested. Submit a new version when ready.</p>}
          </form>
        )}
        {task.status === "in_review" && !isReviewer && <p className="mt-3 text-sm text-violet-700">Waiting for {name.get(task.reviewerId ?? "")} to review.</p>}
      </div>
    </div>
  );
}

function Inner() {
  const id = useSearchParams().get("id");
  return <Shell>{(me) => (id ? <TaskView me={me} id={id} /> : <p className="text-sm text-slate-500">No task selected.</p>)}</Shell>;
}

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}
