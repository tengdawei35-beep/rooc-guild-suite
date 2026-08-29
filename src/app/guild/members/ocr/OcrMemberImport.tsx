"use client";

import { useState } from "react";

type Extracted = Record<string, string>;

export default function OcrMemberImport({ onApply }: { onApply: (values: Extracted) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [count, setCount] = useState(0);

  async function runOcr() {
    if (!files.length) return;

    setBusy(true);
    setError(null);
    setText("");
    setCount(0);

    try {
      const body = new FormData();
      files.forEach((file) => body.append("images", file));

      const response = await fetch("/api/guild/members/ocr", {
        method: "POST",
        body,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "OCR failed.");

      const detected = (data.stats ?? {}) as Extracted;
      setCount(Object.keys(detected).length);
      setText(String(data.rawText ?? ""));
      onApply(detected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
      <div>
        <h3 className="font-semibold text-white">Import stats from screenshots</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Upload the General Stats, Quasi-Stats, and Equipment/Notice screenshots. The ROO-specific OCR parser runs on the server and combines the results before filling the editable review form.
        </p>
      </div>

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700"
      />

      {files.length > 0 && (
        <div className="space-y-1 text-xs text-zinc-500">
          <p>{files.length} screenshot{files.length === 1 ? "" : "s"} selected.</p>
          <p>{files.map((file) => file.name).join(" · ")}</p>
        </div>
      )}

      <button
        type="button"
        onClick={runOcr}
        disabled={busy || !files.length}
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Reading ROO screenshots…" : "Read screenshots"}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {count > 0 && (
        <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4">
          <p className="text-sm font-medium text-emerald-300">
            Detected {count} fields. Review and correct the values below before creating the member.
          </p>
        </div>
      )}

      {text && (
        <details>
          <summary className="cursor-pointer text-xs text-zinc-500">Show raw OCR text</summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-900 p-3 text-xs text-zinc-500">{text}</pre>
        </details>
      )}
    </div>
  );
}
