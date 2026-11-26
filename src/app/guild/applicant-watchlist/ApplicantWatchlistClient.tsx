"use client";

import { useCallback, useEffect, useState } from "react";

type Colour = "GREEN" | "YELLOW" | "RED";
type Entry = { id: string; characterName: string; watchlist: Colour; notes: string | null; createdAt: string };
const colourLabel: Record<Colour, string> = { GREEN: "Prioritise accepting", YELLOW: "Review carefully", RED: "Reject" };

async function api<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`Server returned an invalid response (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
  return data as T;
}

export default function ApplicantWatchlistClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState("");
  const [colour, setColour] = useState<Colour>("GREEN");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await api<{ entries: Entry[] }>(await fetch("/api/guild/applicant-watchlist")); setEntries(data.entries); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load watchlist."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function reset() { setName(""); setColour("GREEN"); setNotes(""); setEditing(null); }
  function startEdit(entry: Entry) { setEditing(entry.id); setName(entry.characterName); setColour(entry.watchlist); setNotes(entry.notes ?? ""); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/guild/applicant-watchlist", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(editing ? { id: editing } : {}), characterName: name, watchlist: colour, notes }),
      });
      await api(response); reset(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save watchlist entry."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm("Remove this IGN from the preset watchlist? Existing applicant labels will not be changed.")) return;
    setBusy(true); setError("");
    try { await api(await fetch(`/api/guild/applicant-watchlist?id=${encodeURIComponent(id)}`, { method: "DELETE" })); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to remove entry."); }
    finally { setBusy(false); }
  }

  return <main className="hmdl-management"><div className="hmdl-page">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="hmdl-eyebrow">PEOPLE / RECRUITMENT</p><h1 className="hmdl-page-title">Applicant watchlist</h1>
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">Pre-register character names (IGNs) and assign a review colour. New applications with a matching IGN are automatically labelled.</p></div>
    </header>
    {error && <p role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}
    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div className="mb-4"><h2 className="text-lg font-semibold">{editing ? "Edit preset" : "Add an IGN"}</h2><p className="mt-1 text-sm text-zinc-500">Matching ignores capitalisation and leading/trailing spaces.</p></div>
      <form onSubmit={save} className="grid gap-3 md:grid-cols-[1.2fr_1fr_1.5fr_auto]">
        <label className="text-xs text-zinc-400">Character name (IGN)<input required maxLength={80} className="hmdl-field mt-2 w-full" value={name} onChange={e => setName(e.target.value)} placeholder="Enter exact in-game name" /></label>
        <label className="text-xs text-zinc-400">Watchlist colour<select className="hmdl-field mt-2 w-full" value={colour} onChange={e => setColour(e.target.value as Colour)}><option value="GREEN">🟢 Green — Prioritise</option><option value="YELLOW">🟡 Yellow — Review</option><option value="RED">🔴 Red — Reject</option></select></label>
        <label className="text-xs text-zinc-400">Internal notes (optional)<input maxLength={500} className="hmdl-field mt-2 w-full" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason / context for the team" /></label>
        <div className="flex items-end gap-2"><button disabled={busy || !name.trim()} className="hmdl-btn hmdl-btn-primary" type="submit">{busy ? "Saving…" : editing ? "Save changes" : "Add IGN"}</button>{editing && <button type="button" className="hmdl-btn" onClick={reset}>Cancel</button>}</div>
      </form>
    </section>
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Preset entries</h2><p className="mt-1 text-sm text-zinc-500">{entries.length} saved IGN{entries.length === 1 ? "" : "s"}</p></div></div>
      {loading ? <p className="py-8 text-center text-sm text-zinc-500">Loading watchlist…</p> : entries.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">No preset characters yet. Add an IGN above to automatically label matching applications.</p> :
        <div className="divide-y divide-zinc-800">{entries.map(entry => <article key={entry.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><strong>{entry.characterName}</strong><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${entry.watchlist === "GREEN" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : entry.watchlist === "YELLOW" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{colourLabel[entry.watchlist]}</span></div>{entry.notes && <p className="mt-1 text-sm text-zinc-500">{entry.notes}</p>}</div>
          <div className="flex gap-2"><button className="hmdl-btn" disabled={busy} onClick={() => startEdit(entry)}>Edit</button><button className="hmdl-btn hmdl-btn-danger" disabled={busy} onClick={() => void remove(entry.id)}>Remove</button></div>
        </article>)}</div>}
    </section>
  </div></main>;
}
