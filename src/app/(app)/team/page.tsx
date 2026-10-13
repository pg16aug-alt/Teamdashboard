import { requireProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";
import { updateMember } from "@/app/actions";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireProfile(["admin"]);
  const { data: people } = await supabase.from("profiles").select("*").order("active").order("full_name").returns<Profile[]>();

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Team</h1>
      <p className="mb-4 text-sm text-slate-500">New sign-ups appear here as inactive. Approve them and set a role.</p>
      <ErrorBanner error={sp.error} />
      <div className="space-y-2">
        {(people ?? []).map((p) => (
          <form key={p.id} action={updateMember} className={`card flex flex-wrap items-end gap-3 ${p.active ? "" : "border-amber-300 bg-amber-50"}`}>
            <input type="hidden" name="id" value={p.id} />
            <div className="w-48 text-sm font-medium">{p.full_name}{!p.active && <span className="ml-2 text-xs text-amber-700">pending</span>}</div>
            <div>
              <label htmlFor={`role-${p.id}`} className="label">Role</label>
              <select id={`role-${p.id}`} name="role" defaultValue={p.role} className="input">
                <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin / HR</option>
              </select>
            </div>
            <div>
              <label htmlFor={`weekly_capacity_hours-${p.id}`} className="label">Weekly capacity (h)</label>
              <input id={`weekly_capacity_hours-${p.id}`} name="weekly_capacity_hours" type="number" min="1" defaultValue={p.weekly_capacity_hours} className="input w-28" />
            </div>
            <div>
              <label htmlFor={`active-${p.id}`} className="label">Access</label>
              <select id={`active-${p.id}`} name="active" defaultValue={p.active ? "1" : "0"} className="input">
                <option value="1">Active</option><option value="0">Inactive</option>
              </select>
            </div>
            <button className="btn">Save</button>
          </form>
        ))}
      </div>
    </div>
  );
}
