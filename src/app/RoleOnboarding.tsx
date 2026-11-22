"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Task = { id: string; title: string; description: string; href: string; action: string; complete: boolean };
type Journey = { role: "OFFICER" | "MEMBER"; title: string; description: string; tasks: Task[]; completed: number; total: number; dismissed: boolean };

export default function RoleOnboarding() {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(): Promise<boolean> {
    setLoading(true);
    try {
      const response = await fetch("/api/guild/onboarding/role", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The onboarding guide could not be loaded.");
      setJourney(result);
      setError("");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The onboarding guide could not be loaded.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function update(payload: Record<string, unknown>) {
    if (!journey) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/guild/onboarding/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Unable to save your progress. Please try again.");
      const refreshed = await load();
      if (!refreshed) setError("Your progress was saved, but the guide could not refresh. Retry loading to see the latest progress.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your progress.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !journey) return <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400" role="status">Loading your orientation guide…</div>;
  if (!journey) return <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4"><p role="alert" className="text-sm text-rose-300">{error || "The onboarding guide is unavailable."}</p><button type="button" disabled={loading} onClick={() => void load()} className="mt-3 text-sm font-medium text-indigo-300 underline underline-offset-4 disabled:opacity-50">{loading ? "Retrying…" : "Retry loading guide"}</button></div>;
  const percent = Math.round((journey.completed / journey.total) * 100);

  if (journey.dismissed) {
    return <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <p className="text-sm text-zinc-400">Your {journey.role === "OFFICER" ? "officer" : "member"} guide is hidden.</p>
      <button type="button" disabled={busy} onClick={() => void update({ dismissed: false })} className="text-sm font-medium text-indigo-300 hover:text-indigo-200">Reopen guide</button>
    </div>;
  }

  return <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6" aria-labelledby="role-onboarding-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{journey.role === "OFFICER" ? "OFFICER ORIENTATION" : "MEMBER ORIENTATION"}</p>
        <h2 id="role-onboarding-title" className="mt-1 text-lg font-semibold text-zinc-100">{journey.title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">{journey.description}</p>
      </div>
      <button type="button" disabled={busy} onClick={() => void update({ dismissed: true })} className="text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-200">Hide guide</button>
    </div>

    <div className="mt-5 flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: percent + "%" }} /></div>
      <span className="text-xs tabular-nums text-zinc-400">{journey.completed}/{journey.total} explored</span>
    </div>

    <div className="mt-4 grid gap-2 md:grid-cols-2">
      {journey.tasks.map((task, index) => <article key={task.id} className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className={task.complete ? "mt-0.5 text-emerald-400" : "mt-0.5 text-zinc-600"}>{task.complete ? "✓" : String(index + 1).padStart(2, "0")}</span>
          <div className="min-w-0 flex-1">
            <h3 className={task.complete ? "text-sm font-medium text-zinc-500" : "text-sm font-medium text-zinc-200"}>{task.title}</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{task.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link href={task.href} className="text-xs font-medium text-indigo-300 hover:text-indigo-200">{task.action} →</Link>
              <button type="button" disabled={busy} onClick={() => void update({ completedStepIds: task.complete ? journey.tasks.filter((item) => item.complete && item.id !== task.id).map((item) => item.id) : [...journey.tasks.filter((item) => item.complete).map((item) => item.id), task.id] })} className="text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-200">{task.complete ? "Mark as not explored" : "Mark as explored"}</button>
            </div>
          </div>
        </div>
      </article>)}
    </div>

    {journey.completed === journey.total && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-3">
      <p className="text-sm text-emerald-200">You're all set. You can revisit this guide whenever you need it.</p>
      <button type="button" disabled={busy} onClick={() => void update({ reset: true })} className="text-xs font-medium text-emerald-200 underline underline-offset-4">Restart guide</button>
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
  </section>;
}
