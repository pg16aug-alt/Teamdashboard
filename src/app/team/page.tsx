"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { Shell } from "@/components/Shell";
import { ErrorBanner } from "@/components/ui";
import { useCollection } from "@/lib/data";
import { db } from "@/lib/firebase";
import { errMsg } from "@/lib/errors";
import type { Profile, Role } from "@/lib/types";

function TeamPage() {
  const { data: people } = useCollection<Profile>("users");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    try {
      await updateDoc(doc(db(), "users", id), {
        role: String(f.get("role")) as Role,
        active: f.get("active") === "1",
        weeklyCapacityHours: Number(f.get("capacity")) || 40,
      });
      setSaved(id);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  const sorted = [...(people ?? [])].sort((a, b) => Number(a.active) - Number(b.active) || a.fullName.localeCompare(b.fullName));
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Team</h1>
      <p className="mb-4 text-sm text-slate-500">New sign-ups appear here as inactive. Approve them and set a role.</p>
      <ErrorBanner error={error} />
      <div className="space-y-2">
        {sorted.map((p) => (
          <form key={p.id} onSubmit={(e) => save(e, p.id)} className={`card flex flex-wrap items-end gap-3 ${p.active ? "" : "border-amber-300 bg-amber-50"}`}>
            <div className="w-56 text-sm"><div className="font-medium">{p.fullName}{!p.active && <span className="ml-2 text-xs text-amber-700">pending</span>}</div><div className="text-xs text-slate-500">{p.email}</div></div>
            <div>
              <label htmlFor={`role-${p.id}`} className="label">Role</label>
              <select id={`role-${p.id}`} name="role" defaultValue={p.role} className="input">
                <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin / HR</option>
              </select>
            </div>
            <div>
              <label htmlFor={`cap-${p.id}`} className="label">Weekly capacity (h)</label>
              <input id={`cap-${p.id}`} name="capacity" type="number" min="1" defaultValue={p.weeklyCapacityHours} className="input w-28" />
            </div>
            <div>
              <label htmlFor={`act-${p.id}`} className="label">Access</label>
              <select id={`act-${p.id}`} name="active" defaultValue={p.active ? "1" : "0"} className="input">
                <option value="1">Active</option><option value="0">Inactive</option>
              </select>
            </div>
            <button className="btn">Save</button>
            {saved === p.id && <span className="pb-2 text-xs text-emerald-700">Saved</span>}
          </form>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return <Shell roles={["admin"]}>{() => <TeamPage />}</Shell>;
}
