export type Role = "admin" | "manager" | "employee";
export type TaskStatus = "todo" | "in_progress" | "in_review" | "changes_requested" | "done";
export type Priority = "low" | "medium" | "high";
export type AttendanceStatus = "present" | "absent" | "half_day" | "leave";
export type ReviewStatus = "pending" | "approved" | "changes_requested";

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
  weeklyCapacityHours: number;
}
export interface Client { id: string; name: string; logoUrl: string | null; active: boolean }
export interface Project { id: string; clientId: string; name: string }
export interface Task {
  id: string;
  projectId: string; projectName: string; clientId: string; clientName: string;
  title: string; description: string | null;
  status: TaskStatus; priority: Priority; deadline: string; estimatedHours: number | null;
  reviewerId: string | null; assigneeIds: string[];
  submissionCount: number; reviewSub: string | null;
  completedAt: string | null; createdBy: string; createdAt: string;
}
export interface Submission {
  id: string; taskId: string; version: number; link: string; hoursSpent: number;
  note: string | null; isFinal: boolean; submittedBy: string; submittedAt: string;
  review: ReviewStatus | null; reviewNote: string | null; reviewedBy: string | null; reviewedAt: string | null;
}
export interface Attendance { id: string; userId: string; day: string; status: AttendanceStatus }
