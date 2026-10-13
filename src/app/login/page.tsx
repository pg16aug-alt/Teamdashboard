"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
      else {
        router.push("/");
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) setMsg(error.message);
      else if (data.session) {
        router.push("/");
        router.refresh();
      } else setMsg("Account created. Check your email to confirm, then sign in. An admin must approve your account before you can see anything.");
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-semibold">Team Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500">{mode === "in" ? "Sign in to continue" : "Create your account"}</p>
      <form onSubmit={submit} className="card space-y-3">
        {mode === "up" && (
          <div>
            <label htmlFor="name" className="label">Full name</label>
            <input id="name" autoComplete="name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" autoComplete="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" autoComplete={mode === "in" ? "current-password" : "new-password"} className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <button className="btn w-full" disabled={busy}>{mode === "in" ? "Sign in" : "Sign up"}</button>
      </form>
      <button className="mt-4 text-sm text-blue-600" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }}>
        {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
