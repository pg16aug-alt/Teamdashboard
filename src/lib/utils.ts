import type { AttendanceStatus, Priority, Task, TaskStatus } from "./types";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  changes_requested: "Changes requested",
  done: "Done",
};
export const STATUS_STYLE: Record<TaskStatus, string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-800",
  in_review: "bg-violet-100 text-violet-800",
  changes_requested: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
};
export const PRIORITY_STYLE: Record<Priority, string> = {
  low: "text-slate-500",
  medium: "text-amber-600",
  high: "text-red-600 font-semibold",
};
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half day",
  leave: "Leave",
};
export const ATTENDANCE_STYLE: Record<AttendanceStatus, string> = {
  present: "bg-emerald-100 text-emerald-800",
  absent: "bg-red-100 text-red-800",
  half_day: "bg-amber-100 text-amber-800",
  leave: "bg-sky-100 text-sky-800",
};

/** Today as YYYY-MM-DD in local time (deadlines are plain dates). */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export type Flag = "overdue" | "at_risk" | null;

/** Overdue: open and past deadline. At risk: open and due within 48h. */
export function taskFlag(t: Pick<Task, "status" | "deadline">): Flag {
  if (t.status === "done") return null;
  const left = daysBetween(today(), t.deadline);
  if (left < 0) return "overdue";
  if (left <= 2) return "at_risk";
  return null;
}

export type Timing = "early" | "on_time" | "late";

/** Judged on the date the final version was approved. Early = 1+ days before deadline. */
export function completionTiming(t: Pick<Task, "completedAt" | "deadline">): Timing | null {
  if (!t.completedAt) return null;
  const done = new Date(t.completedAt);
  const doneDay = `${done.getFullYear()}-${String(done.getMonth() + 1).padStart(2, "0")}-${String(done.getDate()).padStart(2, "0")}`;
  const diff = daysBetween(doneDay, t.deadline);
  return diff < 0 ? "late" : diff >= 1 ? "early" : "on_time";
}

export function fmtDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
