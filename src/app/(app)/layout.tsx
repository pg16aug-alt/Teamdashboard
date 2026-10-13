import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { signOut } from "../actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();

  if (!profile.active) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold">Waiting for approval</h1>
        <p className="mb-4 text-sm text-slate-600">
          Hi {profile.full_name}, your account is created. An admin needs to approve it before you can use the dashboard.
        </p>
        <form action={signOut}><button className="btn-ghost">Sign out</button></form>
      </main>
    );
  }

  const isManager = profile.role === "admin" || profile.role === "manager";
  const links = [
    { href: "/", label: "Tasks" },
    { href: "/attendance", label: "Attendance" },
    ...(isManager ? [{ href: "/analytics", label: "Analytics" }, { href: "/reports", label: "Client reports" }, { href: "/clients", label: "Clients" }] : []),
    ...(profile.role === "admin" ? [{ href: "/team", label: "Team" }] : []),
  ];

  return (
    <div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold">Team Dashboard</span>
          <nav className="flex flex-wrap gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-slate-600 hover:text-blue-600">{l.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-600">
            <span>{profile.full_name} <span className="text-slate-400">({profile.role === "admin" ? "Admin/HR" : profile.role})</span></span>
            <form action={signOut}><button className="btn-ghost !py-1">Sign out</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
