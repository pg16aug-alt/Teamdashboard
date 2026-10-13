import type { SupabaseClient } from "@supabase/supabase-js";
import type { Submission, Task } from "./types";
import { completionTiming } from "./utils";

export interface ReportRow {
  project: string;
  title: string;
  deadline: string;
  completed: string;
  timing: string;
  hours: number;
  link: string;
}

/** Completed tasks for a client in a month, with the final deliverable link. */
export async function clientMonthReport(supabase: SupabaseClient, clientId: string, month: string) {
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", clientId).single();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, projects!inner(*, clients(*)), task_assignees(user_id)")
    .eq("projects.client_id", clientId)
    .eq("status", "done")
    .returns<Task[]>();
  const inMonth = (tasks ?? []).filter((t) => t.completed_at?.slice(0, 7) === month);
  const { data: subs } = inMonth.length
    ? await supabase.from("submissions").select("*").in("task_id", inMonth.map((t) => t.id)).returns<Submission[]>()
    : { data: [] as Submission[] };

  const rows: ReportRow[] = inMonth
    .sort((a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""))
    .map((t) => {
      const mine = (subs ?? []).filter((s) => s.task_id === t.id);
      const final = mine.filter((s) => s.is_final && s.review === "approved").sort((a, b) => b.version - a.version)[0];
      const k = completionTiming(t);
      return {
        project: t.projects.name,
        title: t.title,
        deadline: t.deadline,
        completed: (t.completed_at ?? "").slice(0, 10),
        timing: k === "early" ? "Ahead of deadline" : k === "on_time" ? "On the deadline" : "Late",
        hours: mine.reduce((a, s) => a + Number(s.hours_spent), 0),
        link: final?.link ?? "",
      };
    });
  return { client: client as { id: string; name: string } | null, rows };
}
