"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import type { Profile, Role } from "@/lib/types";

/** Page wrapper: requires sign-in and approval, optionally restricts by role, renders the nav. */
export function Shell({ roles, children }: { roles?: Role[]; children: (profile: Profile) => React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (profile?.active && roles && !roles.includes(profile.role)) router.replace("/");
  }, [loading, user, profile, roles, router]);

  if (loading || !user) return <p className="p-8 text-sm text-slate-500">Loading…</p>;
  if (!profile) return <p className="p-8 text-sm text-slate-500">Setting up your profile…</p>;

  if (!profile.active) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 text-center">
        <h1 className="mb-2 text-xl font-semibold">Waiting for approval</h1>
        <p className="mb-4 text-sm text-slate-600">
          Hi {profile.fullName}, your account is created. An admin needs to approve it before you can use the dashboard.
        </p>
        <button className="btn-ghost" onClick={() => signOut()}>Sign out</button>
      </main>
    );
  }
  if (roles && !roles.includes(profile.role)) return null;

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
            <span>{profile.fullName} <span className="text-slate-400">({profile.role === "admin" ? "Admin/HR" : profile.role})</span></span>
            <button className="btn-ghost !py-1" onClick={() => signOut()}>Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children(profile)}</main>
    </div>
  );
}
