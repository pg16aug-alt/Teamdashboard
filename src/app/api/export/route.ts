import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clientMonthReport } from "@/lib/report";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorized", { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role, active").eq("id", auth.user.id).single();
  if (!me?.active || me.role === "employee") return new NextResponse("Forbidden", { status: 403 });

  const clientId = req.nextUrl.searchParams.get("client") ?? "";
  const month = req.nextUrl.searchParams.get("month") ?? "";
  if (!clientId || !/^\d{4}-\d{2}$/.test(month)) return new NextResponse("Bad request", { status: 400 });

  const { client, rows } = await clientMonthReport(supabase, clientId, month);
  if (!client) return new NextResponse("Not found", { status: 404 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(month);
  ws.columns = [
    { header: "Project", key: "project", width: 24 },
    { header: "Deliverable", key: "title", width: 40 },
    { header: "Deadline", key: "deadline", width: 14 },
    { header: "Completed", key: "completed", width: 14 },
    { header: "Result", key: "timing", width: 20 },
    { header: "Hours", key: "hours", width: 8 },
    { header: "Link", key: "link", width: 60 },
  ];
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => {
    const row = ws.addRow(r);
    if (r.link) row.getCell("link").value = { text: r.link, hyperlink: r.link };
  });
  const buf = await wb.xlsx.writeBuffer();
  const safe = client.name.replace(/[^\w-]+/g, "_");
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}_${month}.xlsx"`,
    },
  });
}
