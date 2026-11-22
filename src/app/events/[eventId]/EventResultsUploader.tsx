"use client";

import { useEffect, useState } from "react";

type ImageItem = { id: string; fileName: string; contentType: string; size: number; createdAt: string };

export default function EventResultsUploader({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");\n  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0, fileName: "" });

  async function load() {
    const response = await fetch(`/api/events/${eventId}/results`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load screenshots.");
    setImages(data.images ?? []);
  }

  useEffect(() => { load().catch(e => setError(e instanceof Error ? e.message : "Unable to load screenshots.")); }, [eventId]);

  async function upload() {
    if (!files.length) return;
    if (files.length > 12) { setError("Upload up to 12 screenshots at a time."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      let uploaded = 0;
      setUploadProgress({ completed: 0, total: files.length, fileName: files[0]?.name ?? "" });\n      for (const [index, file] of files.entries()) {\n        setUploadProgress({ completed: index, total: files.length, fileName: file.name });
        const form = new FormData();
        form.append("file", file);
        const response = await fetch(`/api/events/${eventId}/results`, { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "A screenshot failed to upload.");
        uploaded++;\n        setUploadProgress({ completed: uploaded, total: files.length, fileName: file.name });
      }
      setFiles([]);
      await load();
      setMessage(uploaded + " screenshot(s) uploaded.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to upload screenshots."); }
    finally { setBusy(false); setUploadProgress({ completed: 0, total: 0, fileName: "" }); }
  }

  return <section className="hmdl-event-results-panel mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
    <div><h2 className="text-lg font-semibold">Event Results</h2><p className="mt-1 text-sm text-zinc-500">Screenshots are stored privately and remain attached to this event.</p></div>
    {canManage && <div className="mt-4 flex flex-wrap items-center gap-3"><label htmlFor="event-result-files" className="sr-only">Choose event result screenshots</label><input id="event-result-files" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy} onChange={e => setFiles(Array.from(e.target.files ?? []))} className="block max-w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200" /><button disabled={busy || !files.length} onClick={upload} className="hmdl-btn hmdl-btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40">{busy ? "Uploading…" : "Upload screenshots"}</button></div>}
    {files.length > 0 && <p className="mt-2 text-xs text-zinc-500">{files.length} selected · max 4 MB each · PNG, JPEG or WebP</p>}
    {busy && <div className="mt-3" role="status" aria-live="polite"><div className="flex flex-wrap justify-between gap-2 text-xs text-zinc-400"><span>Uploading {uploadProgress.fileName}</span><span>{uploadProgress.completed} / {uploadProgress.total} complete</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${uploadProgress.total ? (uploadProgress.completed / uploadProgress.total) * 100 : 0}%` }} /></div></div>}\n    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}
    {images.length ? <div className="hmdl-results-grid mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map(image => <a key={image.id} href={`/api/events/results/${image.id}`} target="_blank" rel="noreferrer" className="hmdl-result-image overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"><img src={`/api/events/results/${image.id}`} alt={image.fileName} className="hmdl-result-preview h-48 w-full object-contain" /><div className="p-3"><p className="truncate text-sm text-zinc-300">{image.fileName}</p><p className="mt-1 text-xs text-zinc-600">{(image.size / 1024 / 1024).toFixed(2)} MB · {new Date(image.createdAt).toLocaleString()}</p></div></a>)}</div> : <p className="mt-4 text-sm text-zinc-500">No result screenshots have been uploaded for this event.</p>}
  </section>;
}
