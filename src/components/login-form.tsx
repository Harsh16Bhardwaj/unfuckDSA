"use client";

import { ArrowRight, AtSign, LockKeyhole, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { email: identity, password, username } : { identity, password }),
        signal: AbortSignal.timeout(12_000),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? (mode === "signup" ? "Sign-up failed." : "Sign-in failed."));
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "TimeoutError" ? "The account server took too long to respond. Check MongoDB Atlas Network Access and try again." : error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story"><div className="auth-glow one" /><div className="auth-glow two" /><div className="brand-mark">uD</div><span className="eyebrow accent">Recall before rust</span><h1>Your practice deserves a <em>memory.</em></h1><p>One focused home for LeetCode sessions, spaced revision and the work you promise yourself each week.</p><div className="auth-points"><span><ShieldCheck size={16} /> Your own private workspace</span><span><LockKeyhole size={16} /> Passwords are salted and hashed</span><span><Sparkles size={16} /> Built for daily use, not admin work</span></div></section>
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-tabs"><Link className={mode === "login" ? "active" : ""} href="/login">Sign in</Link><Link className={mode === "signup" ? "active" : ""} href="/signup">Create account</Link></div>
        <span className="eyebrow">{mode === "login" ? "Welcome back" : "New workspace"}</span>
        <h2>{mode === "login" ? "Pick up where you left off" : "Make this system yours"}</h2>
        <p>{mode === "login" ? "Your plan, sessions and weekly commitments are ready." : "Choose one unique username. You can start with a completely clean dashboard."}</p>
        {mode === "signup" && <label>Username<div className="auth-input"><UserRound size={17} /><input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" autoComplete="username" placeholder="harsh_dsa" required /></div></label>}
        <label>{mode === "login" ? "Email or username" : "Email"}<div className="auth-input"><AtSign size={17} /><input type={mode === "login" ? "text" : "email"} value={identity} onChange={(event) => setIdentity(event.target.value)} autoComplete={mode === "login" ? "username" : "email"} placeholder={mode === "login" ? "you@example.com or username" : "you@example.com"} required /></div></label>
        <label>Password<div className="auth-input"><LockKeyhole size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" required /></div></label>
        {message && <div className="auth-error">{message}</div>}
        <button className="primary-button auth-submit" disabled={busy}>{busy ? "Opening your workspace…" : mode === "login" ? "Sign in" : "Create account"}<ArrowRight size={16} /></button>
        <small className="auth-footnote">No social login, no onboarding maze. Just your account and your work.</small>
      </form>
    </main>
  );
}
