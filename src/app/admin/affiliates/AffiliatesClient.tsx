"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Affiliate = { id: string; name: string; code: string; discountPercent: number; commissionPercent: number; active: boolean; referralCount: number; commissionCount: number; commissionCents: number };

export default function AffiliatesClient() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("10");
  const [commission, setCommission] = useState("20");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/affiliates", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load affiliates.");
      setAffiliates(data as Affiliate[]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load affiliates."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function createAffiliate(event: React.FormEvent) {
    event.preventDefault(); setMessage(""); setSaving(true);
    try {
      const response = await fetch("/api/admin/affiliates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, code, discountPercent: Number(discount), commissionPercent: Number(commission) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === "CODE_ALREADY_EXISTS" ? "That referral code already exists." : data.error ?? "Unable to create affiliate.");
      setName(""); setCode(""); setDiscount("10"); setCommission("20"); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create affiliate."); }
    finally { setSaving(false); }
  }

  async function toggle(id: string) {
    setMessage("");
    const response = await fetch("/api/admin/affiliates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) });
    if (!response.ok) { const data = await response.json(); setMessage(data.error ?? "Unable to update affiliate."); return; }
    await load();
  }

  return <main className="min-h-screen bg-zinc-950 text-white"><div className="mx-auto max-w-6xl px-6 py-10">
    <div className="flex items-center justify-between gap-4"><div><Link href="/admin" className="text-sm text-zinc-500 hover:text-white">← Platform Administration</Link><p className="mt-7 text-sm font-medium uppercase tracking-widest text-zinc-500">Referral Program</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Affiliates</h1><p className="mt-2 text-sm text-zinc-400">Manage influencer referral codes and recurring discounts.</p></div></div>
    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><h2 className="text-lg font-semibold">Create affiliate</h2><form onSubmit={createAffiliate} className="mt-5 grid gap-4 md:grid-cols-4"><label className="text-sm text-zinc-400">Influencer name<input value={name} onChange={e => setName(e.target.value)} required maxLength={100} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-zinc-400" placeholder="Creator name" /></label><label className="text-sm text-zinc-400">Referral code<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} required minLength={3} maxLength={32} pattern="[A-Z0-9_-]+" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 font-mono text-white outline-none focus:border-zinc-400" placeholder="CREATOR10" /></label><label className="text-sm text-zinc-400">Customer discount %<input type="number" min="0" max="100" step="0.1" value={discount} onChange={e => setDiscount(e.target.value)} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-zinc-400" /></label><label className="text-sm text-zinc-400">Commission %<input type="number" min="0" max="100" step="0.1" value={commission} onChange={e => setCommission(e.target.value)} className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white outline-none focus:border-zinc-400" /></label><div className="md:col-span-4"><button disabled={saving} className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50">{saving ? "Creating…" : "Create affiliate"}</button></div></form></section>
    {message && <p className="mt-4 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{message}</p>}
    <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"><div className="border-b border-zinc-800 px-6 py-5"><h2 className="font-semibold">Referral codes</h2><p className="mt-1 text-sm text-zinc-500">Customers receive the configured discount on eligible recurring subscription charges.</p></div>{loading ? <p className="p-6 text-sm text-zinc-500">Loading…</p> : affiliates.length === 0 ? <p className="p-6 text-sm text-zinc-500">No affiliates yet.</p> : <div className="divide-y divide-zinc-800">{affiliates.map(a => <div key={a.id} className="grid gap-4 px-6 py-5 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:items-center"><div><p className="font-semibold">{a.name}</p><p className="mt-1 font-mono text-sm text-zinc-400">{a.code}</p></div><div><p className="text-xs uppercase tracking-wider text-zinc-600">Discount</p><p className="mt-1 text-sm">{a.discountPercent}% recurring</p></div><div><p className="text-xs uppercase tracking-wider text-zinc-600">Referrals</p><p className="mt-1 text-sm">{a.referralCount}</p></div><div><p className="text-xs uppercase tracking-wider text-zinc-600">Commission</p><p className="mt-1 text-sm">{a.commissionCount} · {(a.commissionCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}</p></div><button onClick={() => void toggle(a.id)} className={`rounded-lg border px-3 py-2 text-xs font-medium ${a.active ? "border-emerald-800 text-emerald-300 hover:border-emerald-600" : "border-zinc-700 text-zinc-500 hover:text-white"}`}>{a.active ? "Active" : "Disabled"}</button></div>)}</div>}</section>
  </div></main>;
}
