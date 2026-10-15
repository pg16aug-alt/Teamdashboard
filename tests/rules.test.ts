import "firebase/compat/firestore";
import { readFileSync } from "node:fs";
import test, { before, after, beforeEach } from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, getDoc, deleteDoc, writeBatch, serverTimestamp } from "firebase/firestore";

let env: RulesTestEnvironment;
const ctx = (uid: string) => env.authenticatedContext(uid).firestore();

const baseTask = {
  projectId: "p1", projectName: "Site", clientId: "c1", clientName: "Acme", title: "Task", description: null,
  status: "todo", priority: "medium", deadline: "2026-12-31", estimatedHours: null, reviewerId: null,
  assigneeIds: ["emp"], submissionCount: 0, reviewSub: null, completedAt: null,
};

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-teamdashboard",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
after(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const u = (id: string, role: string, active = true) =>
      setDoc(doc(db, "users", id), { fullName: id, email: `${id}@x.com`, role, active, weeklyCapacityHours: 40 });
    await Promise.all([u("adm", "admin"), u("mgr", "manager"), u("emp", "employee"), u("rev", "employee"),
      u("oth", "employee"), u("pend", "employee", false)]);
    await setDoc(doc(db, "clients", "c1"), { name: "Acme", logoUrl: null, active: true });
    await setDoc(doc(db, "tasks", "t1"), { ...baseTask, createdBy: "mgr", createdAt: new Date() });
    await setDoc(doc(db, "tasks", "t2"), { ...baseTask, title: "Reviewed", reviewerId: "rev", createdBy: "mgr", createdAt: new Date() });
  });
});

const sub = (n: number, over: Record<string, unknown> = {}) => ({
  version: n, link: "https://drive.google.com/x", hoursSpent: 2, note: null, isFinal: true, submittedBy: "emp",
  submittedAt: serverTimestamp(), review: "approved", reviewNote: null, reviewedBy: null, reviewedAt: null, ...over,
});

/** submit work like the app does: submission + task update in one batch */
async function submit(uid: string, tid: string, n: number, subOver: Record<string, unknown>, taskPatch: Record<string, unknown>) {
  const db = ctx(uid);
  const b = writeBatch(db);
  b.set(doc(db, "tasks", tid, "submissions", `v${n}`), sub(n, subOver));
  b.update(doc(db, "tasks", tid), { submissionCount: n, ...taskPatch });
  return b.commit();
}
async function review(uid: string, tid: string, sid: string, approve: boolean, isFinal: boolean, extra: Record<string, unknown> = {}) {
  const db = ctx(uid);
  const b = writeBatch(db);
  b.update(doc(db, "tasks", tid, "submissions", sid), {
    review: approve ? "approved" : "changes_requested", reviewNote: "n", reviewedBy: uid, reviewedAt: serverTimestamp(),
  });
  b.update(doc(db, "tasks", tid), {
    reviewSub: sid, status: approve ? (isFinal ? "done" : "in_progress") : "changes_requested",
    ...(approve && isFinal ? { completedAt: serverTimestamp() } : {}), ...extra,
  });
  return b.commit();
}

test("users: sign-up creates only an inactive employee; inactive users see nothing", async () => {
  const anon = env.authenticatedContext("new").firestore();
  await assertSucceeds(setDoc(doc(anon, "users", "new"), { fullName: "N", email: "n@x.com", role: "employee", active: false, weeklyCapacityHours: 40 }));
  await assertFails(setDoc(doc(env.authenticatedContext("new2").firestore(), "users", "new2"), { fullName: "N", email: "n@x.com", role: "admin", active: true, weeklyCapacityHours: 40 }));
  await assertFails(setDoc(doc(env.authenticatedContext("new3").firestore(), "users", "other"), { fullName: "N", email: "n@x.com", role: "employee", active: false, weeklyCapacityHours: 40 }));
  await assertFails(getDoc(doc(ctx("pend"), "tasks", "t1")));
  await assertSucceeds(getDoc(doc(ctx("pend"), "users", "pend")));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "tasks", "t1")));
  await assertSucceeds(getDoc(doc(ctx("emp"), "tasks", "t1")));
});

test("users: only admin changes roles/approval", async () => {
  await assertSucceeds(updateDoc(doc(ctx("adm"), "users", "pend"), { active: true, role: "employee" }));
  await assertFails(updateDoc(doc(ctx("mgr"), "users", "pend"), { active: true }));
  await assertFails(updateDoc(doc(ctx("emp"), "users", "emp"), { role: "admin" }));
});

test("clients/projects: admin adds clients, managers add projects", async () => {
  await assertSucceeds(setDoc(doc(ctx("adm"), "clients", "c2"), { name: "B", logoUrl: null, active: true }));
  await assertFails(setDoc(doc(ctx("mgr"), "clients", "c3"), { name: "C", logoUrl: null, active: true }));
  await assertSucceeds(setDoc(doc(ctx("mgr"), "projects", "p2"), { clientId: "c1", name: "P" }));
  await assertFails(setDoc(doc(ctx("emp"), "projects", "p3"), { clientId: "c1", name: "P" }));
});

test("tasks: managers create valid tasks; employees cannot; no starting as done", async () => {
  const t = { ...baseTask, createdBy: "mgr", createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(ctx("mgr"), "tasks", "n1"), t));
  await assertFails(setDoc(doc(ctx("emp"), "tasks", "n2"), { ...t, createdBy: "emp" }));
  await assertFails(setDoc(doc(ctx("mgr"), "tasks", "n3"), { ...t, status: "done" }));
  await assertFails(setDoc(doc(ctx("mgr"), "tasks", "n4"), { ...t, assigneeIds: [] }));
});

test("tasks: employee can start work but not edit details or finish directly", async () => {
  await assertSucceeds(updateDoc(doc(ctx("emp"), "tasks", "t1"), { status: "in_progress" }));
  await assertFails(updateDoc(doc(ctx("emp"), "tasks", "t1"), { deadline: "2099-01-01" }));
  await assertFails(updateDoc(doc(ctx("emp"), "tasks", "t1"), { status: "done" }));
  await assertFails(updateDoc(doc(ctx("emp"), "tasks", "t1"), { reviewerId: "emp" }));
  await assertFails(updateDoc(doc(ctx("oth"), "tasks", "t1"), { status: "in_progress" }));
  await assertSucceeds(updateDoc(doc(ctx("mgr"), "tasks", "t1"), { deadline: "2027-01-01" }));
  await assertFails(updateDoc(doc(ctx("mgr"), "tasks", "t1"), { status: "done" }));
  await assertFails(updateDoc(doc(ctx("adm"), "tasks", "t1"), { status: "done", completedAt: serverTimestamp() }));
});

test("no reviewer: a final link + hours completes the task", async () => {
  await assertFails(submit("oth", "t1", 1, { submittedBy: "oth" }, { status: "done", completedAt: serverTimestamp() }));
  await assertFails(submit("emp", "t1", 1, { link: "notalink" }, { status: "done", completedAt: serverTimestamp() }));
  await assertFails(submit("emp", "t1", 1, { hoursSpent: 0 }, { status: "done", completedAt: serverTimestamp() }));
  await assertFails(submit("emp", "t1", 1, {}, { status: "in_progress" })); // final must complete
  await assertFails(submit("emp", "t1", 1, {}, { status: "done" })); // completedAt required
  await assertSucceeds(submit("emp", "t1", 1, {}, { status: "done", completedAt: serverTimestamp() }));
  await assertFails(submit("emp", "t1", 2, { review: null, isFinal: false }, { status: "in_progress" })); // done tasks are closed
});

test("no reviewer: drafts keep the task in progress", async () => {
  await assertSucceeds(submit("emp", "t1", 1, { isFinal: false, review: null }, { status: "in_progress" }));
  await assertFails(submit("emp", "t1", 1, { isFinal: false, review: null }, { status: "in_progress" })); // v1 exists
  await assertSucceeds(submit("emp", "t1", 2, {}, { status: "done", completedAt: serverTimestamp() }));
});

test("reviewed flow: draft, changes, final, approve", async () => {
  // draft goes to the reviewer
  await assertFails(submit("emp", "t2", 1, { isFinal: false, review: null }, { status: "in_review" })); // must be pending
  await assertSucceeds(submit("emp", "t2", 1, { isFinal: false, review: "pending" }, { status: "in_review" }));
  // cannot skip review by claiming approval
  await assertFails(submit("emp", "t2", 2, { review: "approved" }, { status: "done", completedAt: serverTimestamp() }));
  // employee cannot self-review; a non-reviewer manager cannot either
  await assertFails(review("emp", "t2", "v1", true, false));
  await assertFails(review("mgr", "t2", "v1", true, false));
  // reviewer requests changes
  await assertSucceeds(review("rev", "t2", "v1", false, false));
  assertDoc(await getDoc(doc(ctx("emp"), "tasks", "t2")), "changes_requested");
  // double review denied
  await assertFails(review("rev", "t2", "v1", true, false));
  // v2 final goes to review, not done
  await assertFails(submit("emp", "t2", 2, { review: "pending" }, { status: "done", completedAt: serverTimestamp() }));
  await assertSucceeds(submit("emp", "t2", 2, { review: "pending" }, { status: "in_review" }));
  // review without touching the task is denied
  const lone = ctx("rev");
  await assertFails(updateDoc(doc(lone, "tasks", "t2", "submissions", "v2"), { review: "approved", reviewNote: "x", reviewedBy: "rev", reviewedAt: serverTimestamp() }));
  // approving the final completes the task (admin could too)
  await assertSucceeds(review("rev", "t2", "v2", true, true));
  const t = await getDoc(doc(ctx("emp"), "tasks", "t2"));
  if (t.data()?.status !== "done" || !t.data()?.completedAt) throw new Error("task not completed");
  await assertFails(deleteDoc(doc(ctx("adm"), "tasks", "t2", "submissions", "v2")));
});

function assertDoc(snap: { data(): Record<string, unknown> | undefined }, status: string) {
  if (snap.data()?.status !== status) throw new Error(`expected ${status}, got ${snap.data()?.status}`);
}

test("attendance: only admin/HR, doc id must match person and day", async () => {
  const rec = { userId: "emp", day: "2026-10-15", status: "present", markedBy: "adm" };
  await assertSucceeds(setDoc(doc(ctx("adm"), "attendance", "emp_2026-10-15"), rec));
  await assertSucceeds(setDoc(doc(ctx("adm"), "attendance", "emp_2026-10-15"), { ...rec, status: "half_day" }));
  await assertFails(setDoc(doc(ctx("adm"), "attendance", "wrong_id"), rec));
  await assertFails(setDoc(doc(ctx("adm"), "attendance", "emp_2026-10-16"), { ...rec, status: "holiday", day: "2026-10-16" }));
  await assertFails(setDoc(doc(ctx("mgr"), "attendance", "emp_2026-10-17"), { ...rec, day: "2026-10-17", markedBy: "mgr" }));
  await assertFails(setDoc(doc(ctx("emp"), "attendance", "emp_2026-10-18"), { ...rec, day: "2026-10-18", markedBy: "emp" }));
  await assertSucceeds(getDoc(doc(ctx("emp"), "attendance", "emp_2026-10-15")));
  await assertSucceeds(deleteDoc(doc(ctx("adm"), "attendance", "emp_2026-10-15")));
});
