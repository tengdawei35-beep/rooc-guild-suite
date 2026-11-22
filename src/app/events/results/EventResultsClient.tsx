"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ImageItem = { id: string; fileName: string; contentType: string; size: number; createdAt: string };
type Group = { event: { id: string; type: string; eventTypeName: string | null; scheduleTimeZone: string | null; date: string }; images: ImageItem[] };

function label(type: string, name: string | null) {
  if (type === "RO3_CUSTOM") return name || "RO3 Event";
  return type === "GUILD_LEAGUE" ? "Guild League" : "Emperium Overrun";
}

export default function EventResultsClient() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/events/results", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load event results.");
      setGroups(data.results ?? []);
    }).catch(e => setError(e instanceof Error ? e.message : "Unable to load event results.")).finally(() => setLoading(false));
  }, []);
  if (loading) return <p className="hmdl-results-loading mt-8 text-sm text-zinc-500">Loading event results…</p>;
  if (error) return <p className="hmdl-results-error mt-8 text-sm text-red-300">{error}</p>;
  if (!groups.length) return <p className="hmdl-empty mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">No event result screenshots have been uploaded yet.</p>;
  return <div className="hmdl-results-groups mt-8 space-y-6">{groups.map(group => <section key={group.event.id} className="hmdl-results-group rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="hmdl-section-title text-lg font-semibold">{label(group.event.type, group.event.eventTypeName)}</h2><p className="mt-1 text-sm text-zinc-500">{new Intl.DateTimeFormat("en-GB", { timeZone: group.event.scheduleTimeZone || "Asia/Bangkok", dateStyle: "full", timeStyle: "short" }).format(new Date(group.event.date))} · {group.images.length} screenshot(s)</p></div><Link href={`/events/${group.event.id}`} className="hmdl-results-open text-sm text-zinc-300 underline">Open event</Link></div><div className="hmdl-results-grid mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{group.images.map(image => <a key={image.id} href={`/api/events/results/${image.id}`} target="_blank" rel="noreferrer" className="hmdl-result-image overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"><img src={`/api/events/results/${image.id}`} alt={image.fileName} className="hmdl-result-preview h-52 w-full object-contain" /><div className="p-3"><p className="truncate text-sm text-zinc-300">{image.fileName}</p><p className="mt-1 text-xs text-zinc-600">{(image.size / 1024 / 1024).toFixed(2)} MB</p></div></a>)}</div></section>)}</div>;
}
