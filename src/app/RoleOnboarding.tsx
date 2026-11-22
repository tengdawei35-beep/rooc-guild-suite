"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Task = { id: string; title: string; description: string; href: string; action: string; complete: boolean };
type Journey = { role: "OFFICER" | "MEMBER"; title: string; description: string; tasks: Task[]; completed: number; total: number; dismissed: boolean };

export default function RoleOnboarding() {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/guild/onboarding/role", { cache: "no-store" });
      if (!response.ok) return;
      setJourney(await response.json());
    } catch {
      setError("The onboarding guide could not be loaded. Refresh the page to try again.");
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
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your progress.");
    } finally {
      setBusy(false);
    }
  }

  if (!journey) return null;
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
