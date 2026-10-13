"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus, Role } from "@/lib/types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function fail(message: string): never {
  redirect(`?error=${encodeURIComponent(message)}`);
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createTask(form: FormData) {
  const supabase = await createClient();
  const assignees = form.getAll("assignees").map(String);
  if (assignees.length === 0) fail("Pick at least one assignee");
  const est = str(form, "estimated_hours");
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: str(form, "project_id"),
      title: str(form, "title"),
      description: str(form, "description") || null,
      priority: str(form, "priority") || "medium",
      deadline: str(form, "deadline"),
      estimated_hours: est ? Number(est) : null,
      reviewer_id: str(form, "reviewer_id") || null,
    })
    .select("id")
    .single();
  if (error || !data) fail(error?.message ?? "Could not create task");
  const { error: aerr } = await supabase
    .from("task_assignees")
    .insert(assignees.map((user_id) => ({ task_id: data.id, user_id })));
  if (aerr) fail(aerr.message);
  revalidatePath("/");
  redirect(`/tasks/${data.id}`);
}

export async function setProgress(form: FormData) {
  const supabase = await createClient();
  const id = str(form, "task_id");
  const { error } = await supabase.rpc("set_task_progress", { t: id, started: str(form, "started") === "1" });
  if (error) fail(error.message);
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/");
}

export async function submitWork(form: FormData) {
  const supabase = await createClient();
  const id = str(form, "task_id");
  const { error } = await supabase.from("submissions").insert({
    task_id: id,
    link: str(form, "link"),
    hours_spent: Number(str(form, "hours_spent")),
    note: str(form, "note") || null,
    is_final: str(form, "kind") === "final",
  });
  if (error) fail(error.message.includes("check constraint") ? "Enter a valid http(s) link and hours greater than 0" : error.message);
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/");
  redirect(`/tasks/${id}`);
}

export async function reviewSubmission(form: FormData) {
  const supabase = await createClient();
  const id = str(form, "task_id");
  const approve = str(form, "decision") === "approve";
  const note = str(form, "note");
  if (!approve && !note) fail("Add a note explaining what needs to change");
  const { error } = await supabase.rpc("review_task_submission", {
    p_sub: str(form, "submission_id"),
    p_approve: approve,
    p_note: note || null,
  });
  if (error) fail(error.message);
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/");
  redirect(`/tasks/${id}`);
}

export async function markAttendance(form: FormData) {
  const supabase = await createClient();
  const status = str(form, "status") as AttendanceStatus | "";
  const user_id = str(form, "user_id");
  const day = str(form, "day");
  const res = status
    ? await supabase.from("attendance").upsert({ user_id, day, status })
    : await supabase.from("attendance").delete().eq("user_id", user_id).eq("day", day);
  if (res.error) fail(res.error.message);
  revalidatePath("/attendance");
}

export async function addClient(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert({ name: str(form, "name"), logo_url: str(form, "logo_url") || null });
  if (error) fail(error.message);
  revalidatePath("/clients");
}

export async function addProject(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert({ client_id: str(form, "client_id"), name: str(form, "name") });
  if (error) fail(error.message);
  revalidatePath("/clients");
}

export async function updateMember(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      role: str(form, "role") as Role,
      active: str(form, "active") === "1",
      weekly_capacity_hours: Number(str(form, "weekly_capacity_hours")) || 40,
    })
    .eq("id", str(form, "id"));
  if (error) fail(error.message);
  revalidatePath("/team");
}
