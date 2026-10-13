import { requireProfile } from "@/lib/auth";
import { clientMonthReport } from "@/lib/report";
import { fmtDate, today } from "@/lib/utils";

export default async function Reports({ searchParams }: { searchParams: Promise<{ client?: string; month?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireProfile(["admin", "manager"]);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today().slice(0, 7);
  const { data: clients } = await supabase.from("clients").select("id, name").order("name");
  const report = sp.client ? await clientMonthReport(supabase, sp.client, month) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Client month-end report</h1>
      <form className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="client" className="label">Client</label>
          <select id="client" name="client" defaultValue={sp.client ?? ""} className="input" required>
            <option value="" disabled>Select…</option>
            {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label htmlFor="month" className="label">Month</label><input id="month" type="month" name="month" defaultValue={month} className="input" /></div>
        <button className="btn-ghost">Preview</button>
        {report && <a className="btn" href={`/api/export?client=${sp.client}&month=${month}`}>Download Excel</a>}
      </form>

      {report && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-2">Project</th><th className="px-3 py-2">Deliverable</th><th className="px-3 py-2">Deadline</th><th className="px-3 py-2">Completed</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">Link</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{r.project}</td><td className="px-3 py-2 font-medium">{r.title}</td>
                  <td className="px-3 py-2">{fmtDate(r.deadline)}</td><td className="px-3 py-2">{fmtDate(r.completed)}</td>
                  <td className="px-3 py-2">{r.timing}</td>
                  <td className="px-3 py-2">{r.link && <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">Open</a>}</td>
                </tr>
              ))}
              {report.rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Nothing completed for this client in {month}.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
