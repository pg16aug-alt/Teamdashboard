# Team Dashboard: product spec (v1)

Internal tool to track company tasks per client/project, record attendance, and report on delivery performance.

## Stack (free tier, minimal maintenance)
- **Next.js (App Router) + TypeScript + Tailwind**, hosted on Vercel (free).
- **Supabase** (free): Postgres, email/password auth, row-level security. Passkeys are not built in; deferred.
- **Files live in the company Google Drive.** The app stores links only, so no file storage or size limits.
- **Excel export** with `exceljs` (client month-end report).

## Roles
| Role | Can do |
|---|---|
| Admin / HR | Manage users, clients, projects; mark attendance; see everything |
| Manager | Create/assign tasks; see analytics for all people |
| Employee | See all tasks; update/submit only tasks assigned to them; see own stats |

## Task lifecycle
`To do -> In progress -> In review -> Done`, with `Changes requested` looping back from review.
- A task has **one or more assignees** and an **optional reviewer** (any user, not necessarily a manager).
- **No reviewer:** the assignee submits a *final* link + hours, and the task is Done.
- **With reviewer:** a final submission moves the task to In review. The reviewer approves (Done) or requests changes (back to the assignee).
- **Done requires** a Drive/link submission and hours spent. Enforced in the database, not only the UI.

## Drafts and revisions
Each submission is a numbered version (v1, v2, ...) on the task:
- link, **hours spent on this version**, note, `is_final` flag.
- A draft (`is_final = false`) is shared with the reviewer for feedback without closing the task.
- Reviewer feedback is recorded per version (approved / changes requested + note).
- Task total hours = sum over all versions. Final deadline is judged on the approval date.
- Metrics from this: revisions per task, first-pass approval rate, review turnaround.

## Flags
- **At risk:** not done and deadline within 48h. **Overdue:** not done and past deadline.
- **Assignment warning:** assignee is absent/on leave on the deadline day, or over weekly capacity.

## Attendance
HR/Admin marks Present / Absent / Half-day / Leave per person per day (one row per person per day). Monthly grid view.

## Analytics (Managers/Admin)
Completed early / on time / late; overdue open; on-time rate per person (managers only); workload per person (open tasks, estimated + logged hours); revisions per task.

## Client month-end export
Pick client + month -> Excel (.xlsx) listing completed tasks, deliverable links, completion dates, deadline met. Internal only, clients never log in.

## Phases
1. Auth, users, clients/projects, task board, submissions + review, attendance (MVP)
2. Analytics, Excel export, flags
3. Recurring monthly tasks, calendar view, comments, CSV/PDF, passkeys
