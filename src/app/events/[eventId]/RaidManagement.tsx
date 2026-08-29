"use client";

import { useEffect, useMemo, useState } from "react";

type Party = {
  id: string;
  partyNumber: number;
  battlefield: "BATTLEFIELD_1" | "BATTLEFIELD_2";
  raidId: string | null;
};

type Roster = { id: string; name: string; parties: Party[] };
type Raid = { id: string; name: string; partyIds: string[] };

type RaidResponse = { raids: Raid[]; rosters: Roster[]; canEdit: boolean };

export default function RaidManagement({ eventId, canEdit }: { eventId: string; canEdit: boolean }) {
  const [data, setData] = useState<RaidResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newRaidName, setNewRaidName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [editingRaidId, setEditingRaidId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${eventId}/raids`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to load raids.");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load raids.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [eventId]);

  const raidById = useMemo(() => new Map((data?.raids ?? []).map((raid) => [raid.id, raid])), [data]);
  const partyMap = useMemo(() => {
    const map = new Map<string, Party>();
    for (const roster of data?.rosters ?? []) for (const party of roster.parties) map.set(party.id, party);
    return map;
  }, [data]);

  function toggleParty(partyId: string) {
    setSelected((current) => current.includes(partyId) ? current.filter((id) => id !== partyId) : [...current, partyId]);
  }

  async function createRaid() {
    if (!newRaidName.trim() || selected.length === 0) return;
    setCreating(true); setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/raids`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRaidName.trim(), partyIds: selected }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to create raid.");
      setNewRaidName(""); setSelected([]); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to create raid."); }
    finally { setCreating(false); }
  }

  async function saveRaid(raidId: string) {
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/raids`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId, name: editingName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to rename raid.");
      setEditingRaidId(null); setEditingName(""); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to rename raid."); }
    finally { setSaving(false); }
  }

  async function updateRaidParties(raid: Raid, partyId: string) {
    const partyIds = raid.partyIds.includes(partyId) ? raid.partyIds.filter((id) => id !== partyId) : [...raid.partyIds, partyId];
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/raids`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId: raid.id, partyIds }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to update raid parties.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to update raid parties."); }
    finally { setSaving(false); }
  }

  async function deleteRaid(raidId: string) {
    if (!window.confirm("Delete this raid? Its parties will remain in the roster.")) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/raids`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raidId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to delete raid.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to delete raid."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-sm text-zinc-600">Loading raids...</div>;
  if (!data) return null;

  const ungrouped = data.rosters.flatMap((roster) => roster.parties.filter((party) => !party.raidId).map((party) => ({ ...party, rosterName: roster.name })));

  return (
    <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">Raids</h3>
          <p className="mt-1 text-sm text-zinc-600">Group roster parties into larger raid groups. Parties remain part of the roster.</p>
        </div>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">{error}</div>}

      {data.raids.length === 0 ? (
        <p className="mt-5 text-sm text-zinc-600">No raids yet.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {data.raids.map((raid) => (
            <div key={raid.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {editingRaidId === raid.id ? (
                  <div className="flex flex-1 gap-2">
                    <input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none" />
                    <button type="button" disabled={saving} onClick={() => saveRaid(raid.id)} className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-black">Save</button>
                    <button type="button" onClick={() => setEditingRaidId(null)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400">Cancel</button>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-white">{raid.name}</p>
                    <p className="mt-1 text-xs text-zinc-600">{raid.partyIds.length} {raid.partyIds.length === 1 ? "party" : "parties"}</p>
                  </div>
                )}
                {canEdit && editingRaidId !== raid.id && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setEditingRaidId(raid.id); setEditingName(raid.name); }} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:text-white">Rename</button>
                    <button type="button" disabled={saving} onClick={() => deleteRaid(raid.id)} className="rounded-lg border border-red-900/60 px-3 py-2 text-xs text-red-500 hover:bg-red-950/40">Delete</button>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {raid.partyIds.map((partyId) => {
                  const party = partyMap.get(partyId);
                  if (!party) return null;
                  return <span key={partyId} className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">Party {party.partyNumber} · {party.battlefield === "BATTLEFIELD_1" ? "BF1" : "BF2"}</span>;
                })}
              </div>

              {canEdit && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-300">Manage parties</summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {data.rosters.flatMap((roster) => roster.parties.map((party) => (
                      <label key={party.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
                        <input type="checkbox" checked={raid.partyIds.includes(party.id)} disabled={saving} onChange={() => updateRaidParties(raid, party.id)} />
                        <span>Party {party.partyNumber} · {party.battlefield === "BATTLEFIELD_1" ? "BF1" : "BF2"}</span>
                      </label>
                    )))}
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="mt-6 border-t border-zinc-800 pt-5">
          <h4 className="text-sm font-medium">Create Raid</h4>
          <p className="mt-1 text-xs text-zinc-600">Select the parties that should belong to the new raid.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {ungrouped.map((party) => (
              <label key={party.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
                <input type="checkbox" checked={selected.includes(party.id)} onChange={() => toggleParty(party.id)} />
                <span>{party.rosterName} · Party {party.partyNumber} · {party.battlefield === "BATTLEFIELD_1" ? "BF1" : "BF2"}</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={newRaidName} onChange={(e) => setNewRaidName(e.target.value)} placeholder="Raid name, e.g. BLUE" className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600" />
            <button type="button" disabled={creating || !newRaidName.trim() || selected.length === 0} onClick={createRaid} className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40">{creating ? "Creating..." : "Create Raid"}</button>
          </div>
          {ungrouped.length === 0 && <p className="mt-3 text-xs text-zinc-700">All roster parties are currently assigned to a raid.</p>}
        </div>
      )}
    </div>
  );
}
