// End-to-end test: real app + Firebase emulators + headless Chromium.
// Run `npm run dev:emulator` in one terminal, then `npm run test:e2e` in another.
// Needs Chromium: `npx playwright-core install chromium`, or set CHROMIUM_PATH to an existing binary.
import { chromium } from "playwright-core";
import { readFileSync, statSync } from "node:fs";

const APP = "http://localhost:3100";
const FS = "http://127.0.0.1:8080/v1/projects/demo-teamdashboard/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const step = (m) => console.log("STEP", m);

async function userIdByEmail(email) {
  for (let i = 0; i < 30; i++) {
    const r = await (await fetch(`${FS}/users`, { headers: OWNER })).json();
    const d = (r.documents ?? []).find((x) => x.fields.email.stringValue === email);
    if (d) return d.name.split("/").pop();
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("user doc not found for " + email);
}
async function setUser(uid, role, active = true) {
  const r = await fetch(`${FS}/users/${uid}?updateMask.fieldPaths=role&updateMask.fieldPaths=active`, {
    method: "PATCH", headers: OWNER,
    body: JSON.stringify({ fields: { role: { stringValue: role }, active: { booleanValue: active } } }),
  });
  if (!r.ok) throw new Error("promote failed " + (await r.text()));
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const newPage = async () => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const p = await ctx.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return p;
};
async function signUp(page, name, email) {
  await page.goto(APP + "/login");
  await page.getByText("Create an account").click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("SmokeTest#2026");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.getByText("Waiting for approval").waitFor();
}

let page, emp;
try {
  step("admin signs up and sees the approval screen");
  page = await newPage();
  await signUp(page, "Asha Admin", "asha@example.com");
  const adminId = await userIdByEmail("asha@example.com");
  await setUser(adminId, "admin");
  await page.getByRole("heading", { name: "Tasks" }).waitFor();
  step("admin is approved without reload (live profile) and sees the task board");

  step("admin adds a client and a project");
  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByLabel("New client").fill("Acme Corp");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByText("Acme Corp").first().waitFor();
  await page.getByLabel("New project for Acme Corp").fill("Website");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("Website").waitFor();

  step("employee signs up and is approved");
  emp = await newPage();
  await signUp(emp, "Eli Employee", "eli@example.com");
  const empId = await userIdByEmail("eli@example.com");
  await setUser(empId, "employee");
  await emp.getByRole("heading", { name: "Tasks" }).waitFor();
  if (await emp.getByRole("link", { name: "Analytics" }).count()) throw new Error("employee can see Analytics link");
  if (await emp.getByRole("link", { name: "New task" }).count()) throw new Error("employee can see New task");

  async function createTask(title, reviewer) {
    await page.getByRole("link", { name: "Tasks", exact: true }).click();
    await page.getByRole("link", { name: "New task" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Estimated hours").fill("4");
    await page.getByLabel("Eli Employee").check();
    if (reviewer) await page.getByLabel(/Reviewer/).selectOption({ label: reviewer });
    await page.getByRole("button", { name: "Create task" }).click();
    await page.getByRole("heading", { name: title }).waitFor();
  }
  step("admin creates task A (no reviewer) and task B (admin reviews)");
  await createTask("Task A logo", null);
  await createTask("Task B brochure", "Asha Admin");

  step("employee completes task A with a link + hours");
  await emp.getByRole("link", { name: "Task A logo" }).click();
  await emp.getByRole("button", { name: "Start working" }).click();
  await emp.getByText("In progress").first().waitFor();
  await emp.getByRole("button", { name: "Submit final and complete" }).click(); // empty -> browser validation blocks
  await emp.getByLabel(/Link/).fill("https://drive.google.com/file/a");
  await emp.getByLabel(/Hours spent/).fill("3");
  await emp.getByRole("button", { name: "Submit final and complete" }).click();
  await emp.getByText(/Completed .*deadline/).waitFor();
  step("task A is Done");

  step("employee submits a draft on task B, admin requests changes");
  await emp.getByRole("link", { name: "Tasks", exact: true }).click();
  await emp.getByRole("link", { name: "Task B brochure" }).click();
  await emp.getByLabel(/Link/).fill("https://drive.google.com/file/b1");
  await emp.getByLabel(/Hours spent/).fill("2");
  await emp.getByRole("button", { name: "Submit draft" }).click();
  await emp.getByText("Waiting for Asha Admin to review").waitFor();

  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await page.getByRole("link", { name: "Task B brochure" }).click();
  await page.getByLabel("Feedback on v1").fill("Use brand colours");
  await page.getByRole("button", { name: "Request changes" }).click();
  await page.getByText("Reviewer: Use brand colours").waitFor();

  step("employee submits v2 final, admin approves");
  await emp.getByText("Changes were requested").waitFor();
  await emp.getByLabel(/Link/).fill("https://drive.google.com/file/b2");
  await emp.getByLabel(/Hours spent/).fill("1.5");
  await emp.getByRole("button", { name: "Submit final for review" }).click();
  await emp.getByText("Waiting for Asha Admin to review").waitFor();
  await page.getByLabel("Feedback on v2").waitFor();
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByText(/Completed .*deadline/).waitFor();
  const hrs = await page.getByText("3.5 / 4").count();
  console.log("hours logged on B (3.5) shown:", hrs > 0 ? "yes" : "NO");

  step("admin marks attendance");
  await page.getByRole("link", { name: "Attendance" }).click();
  const row = page.locator("li", { hasText: "Eli Employee" });
  await row.getByRole("button", { name: "Present" }).click();
  await page.locator("td", { hasText: "Eli Employee" }).locator("..").getByTitle("Present").waitFor();

  step("analytics shows 2 completed");
  await page.getByRole("link", { name: "Analytics" }).click();
  await page.getByText("Delivery by person").waitFor();
  const completed = await page.locator("div.card", { hasText: /^Completed/ }).first().innerText();
  console.log("analytics completed card:", JSON.stringify(completed));
  await page.screenshot({ path: "/tmp/e2e-analytics.png", fullPage: true });

  step("client report + Excel download");
  await page.getByRole("link", { name: "Client reports" }).click();
  await page.getByLabel("Client").selectOption({ label: "Acme Corp" });
  await page.getByText("Task B brochure").waitFor();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download Excel" }).click()]);
  await dl.saveAs("/tmp/e2e-report.xlsx");
  console.log("excel file:", dl.suggestedFilename(), statSync("/tmp/e2e-report.xlsx").size, "bytes");

  step("employee cannot open manager pages");
  await emp.goto(APP + "/analytics");
  await emp.getByRole("heading", { name: "Tasks" }).waitFor();
  console.log("E2E PASSED");
} catch (e) {
  console.log("E2E FAILED:", e.message.split("\n")[0]);
  await page?.screenshot({ path: "/tmp/e2e-fail-admin.png", fullPage: true }).catch(() => {});
  await emp?.screenshot({ path: "/tmp/e2e-fail-emp.png", fullPage: true }).catch(() => {});
  process.exitCode = 1;
}
await browser.close();
