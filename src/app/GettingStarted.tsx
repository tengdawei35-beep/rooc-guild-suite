"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Task = { id: string; title: string; description: string; href: string; complete: boolean };
type State = { tasks: Task[]; completed: number; total: number; dismissed: boolean };

export default function GettingStarted() {
  const [state, setState] = useState<State | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/guild/onboarding", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then((data: State | null) => { if (data) { setState(data); setHidden(data.dismissed); } }).catch(() => undefined); }, []);
  async function dismiss() {
    setBusy(true);
    try { const response = await fetch("/api/guild/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dismissed: true }) }); if (response.ok) setHidden(true); }
    finally { setBusy(false); }
  }
  if (!state || hidden || state.completed === state.total) return null;
  const percent = Math.round((state.completed / state.total) * 100);
  return <section className="mx-auto mb-8 w-full max-w-[96rem] rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6" aria-labelledby="getting-started-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">YOUR GUILD SETUP</p><h2 id="getting-started-title" className="mt-1 text-lg font-semibold text-zinc-100">Getting started with Heimdall</h2><p className="mt-1 text-sm text-zinc-400">Complete these essentials to get your guild operations running.</p></div>
      <button type="button" onClick={dismiss} disabled={busy} className="text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-200">Dismiss checklist</button>
    </div>
    <div className="mt-5 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: percent + "%" }} /></div><span className="text-xs tabular-nums text-zinc-400">{state.completed}/{state.total}</span></div>
    <div className="mt-4 grid gap-2 md:grid-cols-2">
      {state.tasks.map(task => <div key={task.id} className="flex items-start gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3">
        <span aria-hidden="true" className={task.complete ? "mt-0.5 text-emerald-400" : "mt-0.5 text-zinc-600"}>{task.complete ? "✓" : "○"}</span>
        <div className="min-w-0 flex-1"><p className={task.complete ? "text-sm text-zinc-500 line-through" : "text-sm font-medium text-zinc-200"}>{task.title}</p><p className="mt-0.5 text-xs text-zinc-500">{task.description}</p></div>
        {!task.complete && <Link href={task.href} className="shrink-0 text-xs font-medium text-indigo-300 hover:text-indigo-200">Set up →</Link>}
      </div>)}
    </div>
  </section>;
}
