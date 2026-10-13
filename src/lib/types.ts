export type Role = "admin" | "manager" | "employee";
export type TaskStatus = "todo" | "in_progress" | "in_review" | "changes_requested" | "done";
export type Priority = "low" | "medium" | "high";
export type AttendanceStatus = "present" | "absent" | "half_day" | "leave";
export type ReviewStatus = "pending" | "approved" | "changes_requested";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  active: boolean;
  weekly_capacity_hours: number;
}
export interface Client { id: string; name: string; logo_url: string | null; active: boolean }
export interface Project { id: string; client_id: string; name: string; active: boolean; clients?: Client }
export interface Submission {
  id: string; task_id: string; version: number; link: string; hours_spent: number;
  note: string | null; is_final: boolean; submitted_by: string; submitted_at: string;
  review: ReviewStatus | null; review_note: string | null; reviewed_at: string | null;
}
export interface Task {
  id: string; project_id: string; title: string; description: string | null;
  status: TaskStatus; priority: Priority; deadline: string; estimated_hours: number | null;
  reviewer_id: string | null; completed_at: string | null; created_at: string;
  projects: Project & { clients: Client };
  task_assignees: { user_id: string }[];
  submissions?: Submission[];
}
