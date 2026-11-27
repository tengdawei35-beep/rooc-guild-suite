"use client";

import { useEffect, useState } from "react";

type ImageItem = { id: string; fileName: string; contentType: string; size: number; createdAt: string };

const MAX_FILES = 12;
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export default function EventResultsUploader({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0, fileName: "" });

  async function load() {
    const response = await fetch(`/api/events/${eventId}/results`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load screenshots.");
    setImages(data.images ?? []);
  }

  useEffect(() => {
    load().catch(e => setError(e instanceof Error ? e.message : "Unable to load screenshots."));
  }, [eventId]);

  function handleFileSelection(selected: File[]) {
    setError("");
    setMessage("");
    if (selected.length > MAX_FILES) {
      setFiles([]);
      setError(`Select up to ${MAX_FILES} screenshots at a time.`);
      return;
    }
    const invalid = selected.find(file => !ALLOWED_TYPES.has(file.type) || file.size < 1 || file.size > MAX_FILE_SIZE);
    if (invalid) {
      setFiles([]);
      setError(`${invalid.name}: choose a PNG, JPEG or WebP image no larger than 4 MB.`);
      return;
    }
    setFiles(selected);
  }

  async function upload() {
    if (!files.length || busy) return;
    setBusy(true);
    setError("");
    setMessage("");

    const pending = [...files];
    let uploaded = 0;
    let uploadError = "";

    try {
      for (let index = 0; index < pending.length; index++) {
        const file = pending[index];
        setUploadProgress({ completed: uploaded, total: pending.length, fileName: file.name });
        try {
          const form = new FormData();
          form.append("file", file);
          const response = await fetch(`/api/events/${eventId}/results`, { method: "POST", body: form });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "A screenshot failed to upload.");
          uploaded++;
        } catch (e) {
          uploadError = e instanceof Error ? e.message : "Unable to upload screenshot.";
          break;
        }
      }

      const remaining = pending.slice(uploaded);
      setFiles(remaining);

      let refreshError = "";
      try {
        await load();
      } catch (e) {
        refreshError = e instanceof Error ? e.message : "Unable to refresh screenshots.";
      }

      if (uploadError) {
        setError(uploaded > 0 ? `${uploaded} screenshot(s) uploaded. ${remaining.length} remain selected; retry to upload only those remaining. ${uploadError}` : uploadError);
      } else if (refreshError) {
        setError(`${uploaded} screenshot(s) uploaded successfully, but the screenshot list could not refresh. Reload this page to view them. ${refreshError}`);
      } else {
        setMessage(`${uploaded} screenshot(s) uploaded.`);
      }
    } finally {
      setBusy(false);
      setUploadProgress({ completed: 0, total: 0, fileName: "" });
    }
  }

  return <details className="hmdl-event-results-panel group rounded-xl border border-zinc-800 bg-zinc-900/80">
    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
      <span className="font-semibold text-zinc-200">Event Results <span className="ml-2 text-xs font-normal text-zinc-500">{images.length} screenshots</span></span>
      <span className="text-xs text-zinc-500 transition group-open:rotate-180">⌄</span>
    </summary>
    <div className="border-t border-zinc-800 p-4">
    <p className="text-xs text-zinc-500">Screenshots are stored privately and remain attached to this event.</p>
    {canManage && <div className="mt-4 flex flex-wrap items-center gap-3"><label htmlFor="event-result-files" className="sr-only">Choose event result screenshots</label><input id="event-result-files" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy} onChange={e => handleFileSelection(Array.from(e.target.files ?? []))} className="block max-w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-zinc-200" /><button type="button" disabled={busy || !files.length} onClick={upload} className="hmdl-btn hmdl-btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40">{busy ? "Uploading…" : files.length ? `Upload ${files.length} screenshot(s)` : "Upload screenshots"}</button></div>}
    {files.length > 0 && <p className="mt-2 text-xs text-zinc-500">{files.length} selected · max {MAX_FILES} per batch · 4 MB each · PNG, JPEG or WebP</p>}
    {busy && <div className="mt-3" role="status" aria-live="polite"><div className="flex flex-wrap justify-between gap-2 text-xs text-zinc-400"><span>Uploading {uploadProgress.fileName}</span><span>{uploadProgress.completed} / {uploadProgress.total} complete</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-label="Screenshot upload progress" aria-valuemin={0} aria-valuemax={uploadProgress.total} aria-valuenow={uploadProgress.completed}><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${uploadProgress.total ? (uploadProgress.completed / uploadProgress.total) * 100 : 0}%` }} /></div></div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}
    {images.length ? <div className="hmdl-results-grid mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map(image => <a key={image.id} href={`/api/events/results/${image.id}`} target="_blank" rel="noreferrer" className="hmdl-result-image overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"><img src={`/api/events/results/${image.id}`} alt={image.fileName} loading="lazy" className="hmdl-result-preview h-48 w-full object-contain" /><div className="p-3"><p className="truncate text-sm text-zinc-300">{image.fileName}</p><p className="mt-1 text-xs text-zinc-600">{(image.size / 1024 / 1024).toFixed(2)} MB · {new Date(image.createdAt).toLocaleString()}</p></div></a>)}</div> : <p className="mt-4 text-sm text-zinc-500">No result screenshots have been uploaded for this event.</p>}
    </div>
  </details>;
}
