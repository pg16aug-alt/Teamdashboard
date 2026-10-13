import type { Profile, Submission, Task } from "./types";
import { completionTiming, taskFlag } from "./utils";

export interface PersonStats {
  id: string;
  name: string;
  open: number;
  overdue: number;
  openEstHours: number;
  capacity: number;
  completed: number;
  early: number;
  onTime: number;
  late: number;
  onTimeRate: number | null;
  hoursLogged: number;
}

export function computeStats(
  tasks: Task[],
  subs: Submission[],
  people: Profile[],
  month: string, // YYYY-MM, completions in this month
) {
  const inMonth = (iso: string | null) => !!iso && iso.slice(0, 7) === month;
  const done = tasks.filter((t) => t.status === "done" && inMonth(t.completed_at));
  const timing = { early: 0, on_time: 0, late: 0 };
  for (const t of done) {
    const k = completionTiming(t);
    if (k) timing[k]++;
  }

  const perPerson: PersonStats[] = people.map((p) => {
    const mine = tasks.filter((t) => t.task_assignees.some((a) => a.user_id === p.id));
    const open = mine.filter((t) => t.status !== "done");
    const mineDone = mine.filter((t) => t.status === "done" && inMonth(t.completed_at));
    const tm = mineDone.map(completionTiming);
    const late = tm.filter((x) => x === "late").length;
    return {
      id: p.id,
      name: p.full_name,
      open: open.length,
      overdue: open.filter((t) => taskFlag(t) === "overdue").length,
      openEstHours: open.reduce((s, t) => s + Number(t.estimated_hours ?? 0) / t.task_assignees.length, 0),
      capacity: p.weekly_capacity_hours,
      completed: mineDone.length,
      early: tm.filter((x) => x === "early").length,
      onTime: tm.filter((x) => x === "on_time").length,
      late,
      onTimeRate: mineDone.length ? Math.round(((mineDone.length - late) / mineDone.length) * 100) : null,
      hoursLogged: subs
        .filter((s) => s.submitted_by === p.id && s.submitted_at.slice(0, 7) === month)
        .reduce((a, s) => a + Number(s.hours_spent), 0),
    };
  });

  // revisions: number of submissions per completed task; first pass = never sent back
  const byTask = new Map<string, Submission[]>();
  for (const s of subs) byTask.set(s.task_id, [...(byTask.get(s.task_id) ?? []), s]);
  const reviewed = done.filter((t) => t.reviewer_id);
  const firstPass = reviewed.filter((t) => !(byTask.get(t.id) ?? []).some((s) => s.review === "changes_requested")).length;
  const avgVersions = done.length ? done.reduce((s, t) => s + (byTask.get(t.id)?.length ?? 0), 0) / done.length : 0;

  const open = tasks.filter((t) => t.status !== "done");
  return {
    completed: done.length,
    timing,
    overdueOpen: open.filter((t) => taskFlag(t) === "overdue").length,
    dueSoon: open.filter((t) => taskFlag(t) === "at_risk").length,
    openCount: open.length,
    firstPassRate: reviewed.length ? Math.round((firstPass / reviewed.length) * 100) : null,
    avgVersions: Math.round(avgVersions * 10) / 10,
    perPerson,
  };
}
