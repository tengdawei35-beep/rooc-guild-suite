import Link from "next/link";

import OcrMemberImport from "./OcrMemberImport";

export default function MemberOcrPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/guild/members" className="text-sm text-zinc-500 hover:text-white">← Guild Members</Link>
        <header className="mt-5 mb-8">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Member Management</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Screenshot OCR</h1>
          <p className="mt-2 max-w-2xl text-zinc-400">Upload character-stat screenshots to automatically read the values. OCR only suggests values; review them in the member form before saving.</p>
        </header>
        <OcrMemberImport onApply={() => undefined} />
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm text-zinc-400">
          <strong className="text-zinc-200">Important:</strong> OCR is intentionally a review step. Game screenshots can contain overlapping text, icons, or formatting that produces incorrect readings. Never save OCR results without checking them.
        </div>
      </div>
    </main>
  );
}
