"use client";

import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { Shell } from "@/components/Shell";
import { ClientBadge, ErrorBanner } from "@/components/ui";
import { useCollection } from "@/lib/data";
import { db } from "@/lib/firebase";
import { errMsg } from "@/lib/errors";
import type { Client, Profile, Project } from "@/lib/types";

function ClientsPage({ me }: { me: Profile }) {
  const { data: clients } = useCollection<Client>("clients");
  const { data: projects } = useCollection<Project>("projects");
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent<HTMLFormElement>, kind: "client" | "project", clientId?: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError(null);
    try {
      if (kind === "client") {
        await addDoc(collection(db(), "clients"), { name: String(f.get("name")).trim(), logoUrl: String(f.get("logoUrl") ?? "").trim() || null, active: true });
      } else {
        await addDoc(collection(db(), "projects"), { clientId, name: String(f.get("name")).trim() });
      }
      form.reset();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Clients and projects</h1>
      <ErrorBanner error={error} />
      {me.role === "admin" ? (
        <form onSubmit={(e) => add(e, "client")} className="card flex flex-wrap items-end gap-3">
          <div><label htmlFor="cname" className="label">New client</label><input id="cname" name="name" required className="input" /></div>
          <div className="min-w-64 flex-1"><label htmlFor="logo" className="label">Logo URL (optional)</label><input id="logo" name="logoUrl" type="url" className="input" /></div>
          <button className="btn">Add client</button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">Only Admin/HR can add clients. Managers can add projects.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(clients ?? []).sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
          <div key={c.id} className="card">
            <ClientBadge name={c.name} logoUrl={c.logoUrl} />
            <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
              {(projects ?? []).filter((p) => p.clientId === c.id).map((p) => <li key={p.id}>{p.name}</li>)}
            </ul>
            <form onSubmit={(e) => add(e, "project", c.id)} className="mt-3 flex gap-2">
              <input name="name" required aria-label={`New project for ${c.name}`} placeholder="New project" className="input" />
              <button className="btn-ghost">Add</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return <Shell roles={["admin", "manager"]}>{(me) => <ClientsPage me={me} />}</Shell>;
}
