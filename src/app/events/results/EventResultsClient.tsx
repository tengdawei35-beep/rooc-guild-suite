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
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/events/results", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load event results.");
        setGroups(data.results ?? []);
      } catch (e) {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Unable to load event results.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [reloadKey]);

  if (loading) return <p className="hmdl-results-loading mt-8 text-sm text-zinc-500" role="status" aria-live="polite">Loading event results…</p>;
  if (error) return (
    <div className="hmdl-results-error mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-900/50 bg-red-950/20 p-4" role="alert">
      <p className="min-w-0 text-sm text-red-300">{error}</p>
      <button type="button" onClick={() => setReloadKey(key => key + 1)} className="hmdl-btn rounded-lg border border-red-800 px-3 py-2 text-sm text-red-200 transition hover:bg-red-950/50">Try again</button>
    </div>
  );
  if (!groups.length) return <p className="hmdl-empty mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">No event result screenshots have been uploaded yet.</p>;

  return (
    <div className="hmdl-results-groups mt-8 space-y-6">
      {groups.map(group => {
        const headingId = `event-results-${group.event.id}`;
        const timeZone = group.event.scheduleTimeZone || "Asia/Bangkok";
        const eventDate = new Intl.DateTimeFormat("en-GB", {
          timeZone,
          dateStyle: "full",
          timeStyle: "short",
        }).format(new Date(group.event.date));

        return (
          <section key={group.event.id} aria-labelledby={headingId} className="hmdl-results-group rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id={headingId} className="hmdl-section-title text-lg font-semibold">{label(group.event.type, group.event.eventTypeName)}</h2>
                <p className="mt-1 text-sm text-zinc-500">{eventDate} · {group.images.length} screenshot(s)</p>
              </div>
              <Link href={`/events/${group.event.id}`} className="hmdl-results-open shrink-0 text-sm text-zinc-300 underline underline-offset-4 hover:text-white">Open event</Link>
            </div>
            <div className="hmdl-results-grid mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.images.map(image => (
                <a
                  key={image.id}
                  href={`/api/events/results/${image.id}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${image.fileName} in a new tab`}
                  className="hmdl-result-image min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 transition hover:border-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  <img src={`/api/events/results/${image.id}`} alt={image.fileName} loading="lazy" className="hmdl-result-preview h-52 w-full object-contain" />
                  <div className="p-3">
                    <p className="truncate text-sm text-zinc-300">{image.fileName}</p>
                    <p className="mt-1 text-xs text-zinc-600">{(image.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
