"use client";

import { useEffect, useMemo, useState } from "react";
import ManagementPageHeader from "@/app/ManagementPageHeader";

type Affiliate = { id: string; name: string; code: string; discountPercent: number; commissionPercent: number; active: boolean; referralCount: number; commissionCount: number; commissionCents: number };
type Detail = { affiliate: Affiliate; referrals: { id: string; guildId: string | null; guildName: string | null; stripeSubscriptionId: string | null; createdAt: string }[]; commissions: { id: string; referralId: string; stripeInvoiceId: string; amountCents: number; currency: string; status: string; createdAt: string; paidAt: string | null }[] };
type FormState = { name: string; code: string; discount: string; commission: string };
const emptyForm: FormState = { name: "", code: "", discount: "10", commission: "20" };

function money(cents: number, currency = "USD") { return (cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() }); }
function date(value: string) { return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }

export default function AffiliatesClient() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try { const response = await fetch("/api/admin/affiliates", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to load affiliates."); setAffiliates(data as Affiliate[]); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load affiliates."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => ({ total: affiliates.length, active: affiliates.filter(a => a.active).length, referrals: affiliates.reduce((sum, a) => sum + a.referralCount, 0), commissions: affiliates.reduce((sum, a) => sum + a.commissionCents, 0) }), [affiliates]);
  const pending = useMemo(() => selected?.commissions.filter(c => c.status !== "PAID").reduce((sum, c) => sum + c.amountCents, 0) ?? 0, [selected]);

  function beginEdit(a: Affiliate) { setEditing(a.id); setForm({ name: a.name, code: a.code, discount: String(a.discountPercent), commission: String(a.commissionPercent) }); setMessage(""); }
  function cancelEdit() { setEditing(null); setForm(emptyForm); }

  async function showDetails(id: string) {
    setMessage("");
    try { const response = await fetch(`/api/admin/affiliates?id=${encodeURIComponent(id)}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to load affiliate details."); setSelected(data as Detail); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load affiliate details."); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage(""); setSaving(true);
    try { const action = editing ? "update" : "create"; const body = { action, ...(editing ? { id: editing } : {}), name: form.name, code: form.code, discountPercent: Number(form.discount), commissionPercent: Number(form.commission), active: editing ? affiliates.find(a => a.id === editing)?.active ?? true : true }; const response = await fetch("/api/admin/affiliates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error === "CODE_ALREADY_EXISTS" ? "That referral code already exists." : data.error ?? "Unable to save affiliate."); cancelEdit(); await load(); if (editing) await showDetails(editing); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save affiliate."); }
    finally { setSaving(false); }
  }

  async function toggle(id: string) { setMessage(""); const response = await fetch("/api/admin/affiliates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", id }) }); if (!response.ok) { const data = await response.json(); setMessage(data.error ?? "Unable to update affiliate."); return; } await load(); if (selected?.affiliate.id === id) await showDetails(id); }

  async function markPaid(id: string) { setMessage(""); const response = await fetch("/api/admin/affiliates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "markPaid", id }) }); const data = await response.json(); if (!response.ok) { setMessage(data.error ?? "Unable to mark commission paid."); return; } if (selected) await showDetails(selected.affiliate.id); await load(); }

  const input = "mt-1.5 min-w-0 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-sky-500/20";

  return <div className="hmdl-affiliate-workspace space-y-6">
    <ManagementPageHeader eyebrow="PLATFORM · REFERRAL PROGRAM" title="Affiliates" description="Manage influencer referral codes, recurring customer discounts and affiliate commissions." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Affiliates", summary.total], ["Active", summary.active], ["Referrals", summary.referrals], ["Commission", money(summary.commissions)]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5"><p className="text-xs uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}</div>
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">{editing ? "Edit affiliate" : "Create affiliate"}</h2><p className="mt-1 text-sm text-zinc-500">{editing ? "Changes apply to future checkout/referral activity." : "New affiliates receive a 10% customer discount by default."}</p></div>{editing && <button type="button" onClick={cancelEdit} className="text-sm text-zinc-500 hover:text-white">Cancel</button>}</div>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-sm text-zinc-400">Influencer name<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required maxLength={100} className={input} placeholder="Creator name" /></label><label className="text-sm text-zinc-400">Referral code<input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} required minLength={3} maxLength={32} pattern="[A-Z0-9][A-Z0-9_-]{2,31}" className={`${input} font-mono`} placeholder="CREATOR10" /></label><label className="text-sm text-zinc-400">Customer discount %<input type="number" min="0" max="100" step="0.1" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} className={input} /></label><label className="text-sm text-zinc-400">Commission %<input type="number" min="0" max="100" step="0.1" value={form.commission} onChange={e => setForm({ ...form, commission: e.target.value })} className={input} /></label><div className="sm:col-span-2 xl:col-span-4"><button disabled={saving} className="rounded-lg hmdl-btn hmdl-btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-50">{saving ? "Saving…" : editing ? "Save changes" : "Create affiliate"}</button></div></form>
    </section>
    {message && <p className="mt-4 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{message}</p>}
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"><div className="border-b border-zinc-800 px-4 py-4 sm:px-5"><h2 className="font-semibold">Referral codes</h2><p className="mt-1 text-sm text-zinc-500">Select an affiliate to view referred guilds, subscriptions and commissions.</p></div>{loading ? <p className="p-6 text-sm text-zinc-500">Loading…</p> : affiliates.length === 0 ? <p className="p-6 text-sm text-zinc-500">No affiliates yet.</p> : <div className="divide-y divide-zinc-800">{affiliates.map(a => <div key={a.id} className="grid gap-3 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1.4fr)_minmax(90px,1fr)_minmax(80px,1fr)_minmax(130px,1fr)_auto_auto_auto] md:items-center"><button onClick={() => void showDetails(a.id)} className="text-left"><p className="font-semibold hover:text-zinc-300">{a.name}</p><p className="mt-1 font-mono text-sm text-zinc-400">{a.code}</p></button><div><p className="text-xs uppercase tracking-wider text-zinc-600">Discount</p><p className="mt-1 text-sm">{a.discountPercent}% recurring</p></div><div><p className="text-xs uppercase tracking-wider text-zinc-600">Referrals</p><p className="mt-1 text-sm">{a.referralCount}</p></div><div><p className="text-xs uppercase tracking-wider text-zinc-600">Commission</p><p className="mt-1 text-sm">{a.commissionCount} · {money(a.commissionCents)}</p></div><button onClick={() => void showDetails(a.id)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-white">Details</button><button onClick={() => beginEdit(a)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-white">Edit</button><button onClick={() => void toggle(a.id)} className={`rounded-lg border px-3 py-2 text-xs font-medium ${a.active ? "border-emerald-800 text-emerald-300 hover:border-emerald-600" : "border-zinc-700 text-zinc-500 hover:text-white"}`}>{a.active ? "Active" : "Disabled"}</button></div>)}</div>}</section>

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}><section className="my-auto max-h-[min(90vh,900px)] w-full max-w-5xl overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"><div className="sticky top-0 flex items-start justify-between gap-4 border-b border-zinc-800 bg-zinc-950 px-4 py-4 sm:px-5"><div><p className="font-mono text-sm text-zinc-500">{selected.affiliate.code}</p><h2 className="mt-1 text-2xl font-bold">{selected.affiliate.name}</h2><p className="mt-1 text-sm text-zinc-400">{selected.affiliate.discountPercent}% customer discount · {selected.affiliate.commissionPercent}% commission</p></div><button onClick={() => setSelected(null)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:text-white">Close</button></div>
      <div className="grid gap-3 border-b border-zinc-800 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4"><div><p className="text-xs uppercase text-zinc-600">Referrals</p><p className="mt-1 text-xl font-semibold">{selected.referrals.length}</p></div><div><p className="text-xs uppercase text-zinc-600">Commissions</p><p className="mt-1 text-xl font-semibold">{selected.commissions.length}</p></div><div><p className="text-xs uppercase text-zinc-600">Earned</p><p className="mt-1 text-xl font-semibold">{money(selected.commissions.reduce((s,c) => s + c.amountCents, 0))}</p></div><div><p className="text-xs uppercase text-zinc-600">Pending</p><p className="mt-1 text-xl font-semibold">{money(pending)}</p></div></div>
      <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-2"><div><h3 className="font-semibold">Referred guilds</h3><div className="mt-3 divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">{selected.referrals.length === 0 ? <p className="p-4 text-sm text-zinc-500">No referrals yet.</p> : selected.referrals.map(r => <div key={r.id} className="p-4"><p className="font-medium">{r.guildName ?? "Deleted guild"}</p><p className="mt-1 text-xs text-zinc-500">{date(r.createdAt)} · Subscription: <span className="font-mono">{r.stripeSubscriptionId ?? "Not linked"}</span></p></div>)}</div></div>
        <div><h3 className="font-semibold">Commission history</h3><div className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800">{selected.commissions.length === 0 ? <p className="p-4 text-sm text-zinc-500">No commissions yet.</p> : selected.commissions.map(c => <div key={c.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium">{money(c.amountCents, c.currency)}</p><p className="mt-1 text-xs text-zinc-500">{date(c.createdAt)} · Invoice <span className="font-mono">{c.stripeInvoiceId}</span></p></div>{c.status === "PAID" ? <span className="text-xs font-medium text-emerald-300">Paid{c.paidAt ? ` · ${date(c.paidAt)}` : ""}</span> : <button onClick={() => void markPaid(c.id)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-zinc-500 hover:text-white">Mark paid</button>}</div>)}</div></div></div>
    </section></div>}
  </div>;
}
