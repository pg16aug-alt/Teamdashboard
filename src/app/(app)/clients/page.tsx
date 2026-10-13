import { requireProfile } from "@/lib/auth";
import type { Client, Project } from "@/lib/types";
import { ClientBadge, ErrorBanner } from "@/components/ui";
import { addClient, addProject } from "@/app/actions";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireProfile(["admin", "manager"]);
  const [{ data: clients }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("*").order("name").returns<Client[]>(),
    supabase.from("projects").select("*").order("name").returns<Project[]>(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Clients and projects</h1>
      <ErrorBanner error={sp.error} />
      {profile.role === "admin" ? (
        <form action={addClient} className="card flex flex-wrap items-end gap-3">
          <div><label htmlFor="new-client" className="label">New client</label><input id="new-client" name="name" required className="input" /></div>
          <div className="min-w-64 flex-1"><label htmlFor="logo-url-optional" className="label">Logo URL (optional)</label><input id="logo-url-optional" name="logo_url" type="url" className="input" /></div>
          <button className="btn">Add client</button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">Only Admin/HR can add clients. Managers can add projects.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(clients ?? []).map((c) => (
          <div key={c.id} className="card">
            <ClientBadge client={c} />
            <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
              {(projects ?? []).filter((p) => p.client_id === c.id).map((p) => <li key={p.id}>{p.name}</li>)}
            </ul>
            <form action={addProject} className="mt-3 flex gap-2">
              <input type="hidden" name="client_id" value={c.id} />
              <input name="name" required placeholder="New project" className="input" />
              <button className="btn-ghost">Add</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
