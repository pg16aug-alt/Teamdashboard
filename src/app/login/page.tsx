"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
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
    try {
      if (mode === "in") await signIn(email, password);
      else await signUp(name, email, password);
      router.push("/");
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setMsg(
        code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found") ? "Wrong email or password"
        : code.includes("email-already-in-use") ? "That email already has an account. Sign in instead."
        : code.includes("weak-password") ? "Password must be at least 6 characters"
        : (err as Error).message,
      );
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
