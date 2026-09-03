"use client";

import { useMemo, useState, type FormEvent } from "react";

type Member = { id: string; characterName: string | null; priority: string; eligible: boolean };
type Resource = { id: string; name: string; type: "FEATHER" | "CARD"; total: number; perPlayerLimit: number };
type Reservation = { id: string; memberId: string; resourceId: string; quantity: number; memberName: string | null; resourceName: string; resourceType: "FEATHER" | "CARD"; resourceTotal: number };

const TYPE_LABELS = { FEATHER: "Feather", CARD: "Card" };

export default function ReservationsClient({ initialMembers, initialResources, initialReservations }: { initialMembers: Member[]; initialResources: Resource[]; initialReservations: Reservation[] }) {
  const [reservations, setReservations] = useState(initialReservations);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkResourceId, setBulkResourceId] = useState(initialResources[0]?.id ?? "");
  const [bulkQuantities, setBulkQuantities] = useState<Record<string, string>>({});
  const [savingBulk, setSavingBulk] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [form, setForm] = useState({ memberId: initialMembers[0]?.id ?? "", resourceId: initialResources[0]?.id ?? "", quantity: "1" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedBulkResource = initialResources.find((r) => r.id === bulkResourceId);
  const existingByMember = useMemo(() => {
    const map = new Map<string, Reservation>();
    reservations.filter((r) => r.resourceId === bulkResourceId).forEach((r) => map.set(r.memberId, r));
    return map;
  }, [reservations, bulkResourceId]);

  function loadBulkQuantities(resourceId: string) {
    const next: Record<string, string> = {};
    initialMembers.forEach((member) => {
      const existing = reservations.find((r) => r.memberId === member.id && r.resourceId === resourceId);
      if (existing) next[member.id] = String(existing.quantity);
    });
    setBulkQuantities(next);
  }

  function openBulk() {
    setShowBulk(true); setShowForm(false); setError(""); loadBulkQuantities(bulkResourceId);
  }

  function changeBulkResource(resourceId: string) {
    setBulkResourceId(resourceId); loadBulkQuantities(resourceId);
  }

  async function saveBulk() {
    if (!selectedBulkResource) return;
    const entries = Object.entries(bulkQuantities).filter(([, value]) => value.trim() !== "");
    if (!entries.length) return setError("Enter at least one quantity.");
    const invalid = entries.find(([, value]) => !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > selectedBulkResource.total);
    if (invalid) return setError(`Quantities must be whole numbers from 1 to ${selectedBulkResource.total}.`);

    setSavingBulk(true); setError("");
    try {
      const results = await Promise.all(entries.map(async ([memberId, value]) => {
        const existing = existingByMember.get(memberId);
        const response = await fetch("/api/guild/reservations", {
          method: existing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: existing?.id, memberId, resourceId: bulkResourceId, quantity: Number(value) }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to save a reservation.");
        return result.reservation as Reservation;
      }));
      setReservations((current) => {
        const next = [...current];
        results.forEach((reservation) => {
          const index = next.findIndex((item) => item.id === reservation.id);
          if (index >= 0) next[index] = reservation; else next.push(reservation);
        });
        return next.sort((a, b) => (a.memberName ?? "").localeCompare(b.memberName ?? ""));
      });
      setShowBulk(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save bulk reservations.");
    } finally { setSavingBulk(false); }
  }

  function openCreate() {
    setEditing(null); setForm({ memberId: initialMembers[0]?.id ?? "", resourceId: initialResources[0]?.id ?? "", quantity: "1" }); setShowForm(true); setShowBulk(false); setError("");
  }

  function openEdit(reservation: Reservation) {
    setEditing(reservation); setForm({ memberId: reservation.memberId, resourceId: reservation.resourceId, quantity: String(reservation.quantity) }); setShowForm(true); setShowBulk(false); setError("");
  }

  async function saveSingle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/guild/reservations", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing?.id, ...form, quantity: Number(form.quantity) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save reservation.");
      const reservation = result.reservation as Reservation;
      setReservations((current) => {
        const next = editing ? current.map((item) => item.id === reservation.id ? reservation : item) : [...current, reservation];
        return next.sort((a, b) => (a.memberName ?? "").localeCompare(b.memberName ?? ""));
      });
      setShowForm(false); setEditing(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save reservation."); }
    finally { setSaving(false); }
  }

  async function deleteReservation(reservation: Reservation) {
    if (!window.confirm(`Remove ${reservation.resourceName} reservation for ${reservation.memberName}?`)) return;
    try {
      const response = await fetch(`/api/guild/reservations?id=${encodeURIComponent(reservation.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to delete reservation.");
      setReservations((current) => current.filter((item) => item.id !== reservation.id));
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to delete reservation."); }
  }

  return <>
    <div className="mb-6 grid gap-4 sm:grid-cols-3"><SummaryCard label="Reservations" value={reservations.length} /><SummaryCard label="Reserved Quantity" value={reservations.reduce((sum, item) => sum + item.quantity, 0)} /><SummaryCard label="Members With Reservations" value={new Set(reservations.map((item) => item.memberId)).size} /></div>

    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-zinc-500">Reservations are removed from the available allocation pool.</p><div className="flex gap-2"><button type="button" onClick={openBulk} disabled={!initialMembers.length || !initialResources.length} className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40">Bulk Add / Edit</button><button type="button" onClick={openCreate} disabled={!initialMembers.length || !initialResources.length} className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40">+ Add Reservation</button></div></div>

    {error && <div className="mb-6 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">{error}</div>}

    {showBulk && <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Bulk Reservations</h2><p className="mt-1 text-sm text-zinc-500">Choose one resource and enter quantities for multiple members at once. Existing reservations are updated.</p></div><label className="w-full sm:w-72 text-xs font-medium text-zinc-400">Resource<select value={bulkResourceId} onChange={(e) => changeBulkResource(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white">{initialResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} — {TYPE_LABELS[resource.type]}</option>)}</select></label></div>{selectedBulkResource && <><div className="mb-3 flex items-center justify-between text-xs text-zinc-500"><span>Total: {selectedBulkResource.total} · Normal per-player limit: {selectedBulkResource.perPlayerLimit}</span><span>{Object.values(bulkQuantities).filter(Boolean).length} entries</span></div><div className="max-h-[30rem] overflow-y-auto rounded-xl border border-zinc-800"><div className="grid grid-cols-[1fr_140px_90px] gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500"><span>Member</span><span>Quantity</span><span className="text-right">Status</span></div>{initialMembers.map((member) => { const existing = existingByMember.get(member.id); return <div key={member.id} className="grid grid-cols-[1fr_140px_90px] items-center gap-3 border-b border-zinc-800 px-4 py-2.5 last:border-0"><div className="min-w-0"><span className="font-medium">{member.characterName}</span>{!member.eligible && <span className="ml-2 text-xs text-zinc-600">Not eligible</span>}</div><input type="number" min="1" max={selectedBulkResource.total} value={bulkQuantities[member.id] ?? ""} onChange={(e) => setBulkQuantities((current) => ({ ...current, [member.id]: e.target.value }))} placeholder="—" className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-sm text-white outline-none focus:border-zinc-400" /><span className="text-right text-xs text-zinc-500">{existing ? "Existing" : bulkQuantities[member.id] ? "New" : ""}</span></div>; })}</div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setShowBulk(false); setError(""); }} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">Cancel</button><button type="button" onClick={saveBulk} disabled={savingBulk} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">{savingBulk ? "Saving…" : "Save Reservations"}</button></div></>}</section>}

    {showForm && <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="mb-5"><h2 className="text-lg font-semibold">{editing ? "Edit Reservation" : "Add Reservation"}</h2><p className="mt-1 text-sm text-zinc-500">Reserve a quantity of a resource for a specific member.</p></div><form onSubmit={saveSingle} className="grid gap-4 md:grid-cols-[1fr_1fr_160px_auto] md:items-end"><label className="text-xs font-medium text-zinc-400">Member<select value={form.memberId} onChange={(e) => setForm((current) => ({ ...current, memberId: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white">{initialMembers.map((member) => <option key={member.id} value={member.id}>{member.characterName}{!member.eligible ? " (Not Eligible)" : ""}</option>)}</select></label><label className="text-xs font-medium text-zinc-400">Resource<select value={form.resourceId} onChange={(e) => setForm((current) => ({ ...current, resourceId: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white">{initialResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} — {TYPE_LABELS[resource.type]}</option>)}</select></label><label className="text-xs font-medium text-zinc-400">Quantity<input type="number" min="1" value={form.quantity} onChange={(e) => setForm((current) => ({ ...current, quantity: e.target.value }))} required className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white" /></label><div className="flex gap-2"><button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm hover:bg-zinc-800">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button></div></form></section>}

    {reservations.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-12 text-center"><h2 className="text-xl font-semibold">No reservations yet</h2><p className="mt-2 text-sm text-zinc-400">Use Bulk Add / Edit to quickly reserve a resource for multiple members.</p></div> : <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-zinc-800"><tr><th className="px-5 py-3 font-medium text-zinc-400">Member</th><th className="px-5 py-3 font-medium text-zinc-400">Resource</th><th className="px-5 py-3 font-medium text-zinc-400">Type</th><th className="px-5 py-3 font-medium text-zinc-400">Quantity</th><th className="px-5 py-3 font-medium text-zinc-400">Total</th><th className="px-5 py-3 text-right font-medium text-zinc-400">Actions</th></tr></thead><tbody className="divide-y divide-zinc-800">{reservations.map((reservation) => <tr key={reservation.id} className="hover:bg-zinc-800/50"><td className="px-5 py-3 font-medium">{reservation.memberName}</td><td className="px-5 py-3">{reservation.resourceName}</td><td className="px-5 py-3"><span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs">{TYPE_LABELS[reservation.resourceType]}</span></td><td className="px-5 py-3 font-semibold">{reservation.quantity}</td><td className="px-5 py-3 text-zinc-400">{reservation.resourceTotal}</td><td className="px-5 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(reservation)} className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800">Edit</button><button type="button" onClick={() => deleteReservation(reservation)} className="rounded-md border border-red-900 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/50">Delete</button></div></td></tr>)}</tbody></table></div></div>}
  </>;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-sm text-zinc-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>;
}
