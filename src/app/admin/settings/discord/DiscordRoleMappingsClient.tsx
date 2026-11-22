"use client";

import { useCallback, useEffect, useState } from "react";

type Plan = { id: string; name: string };
type Role = { id: string; name: string; position: number };
type Mapping = { id: string; planId: string; discordRoleId: string; discordRoleName: string; enabled: boolean; plan: Plan };

export default function DiscordRoleMappingsClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/discord-role-mappings", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Discord configuration.");
      setPlans(data.plans); setRoles(data.roles); setMappings(data.mappings);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load Discord configuration."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!selectedPlan || !selectedRole) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/discord-role-mappings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId: selectedPlan, discordRoleId: selectedRole }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save mapping.");
      setNotice("Subscription role mapping saved."); setSelectedPlan(""); setSelectedRole(""); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save mapping."); }
    finally { setSaving(false); }
  }

  async function remove(planId: string) {
    if (!window.confirm("Remove this subscription role mapping?")) return;
    const response = await fetch(`/api/admin/discord-role-mappings?planId=${encodeURIComponent(planId)}`, { method: "DELETE" });
    if (!response.ok) { setError("Could not remove mapping."); return; }
    setNotice("Mapping removed."); await load();
  }

  async function runHistoricalSync() {
    if (!window.confirm("Reconcile Discord subscription roles for every guild with an active or trialing subscription? This may take several minutes.")) return;
    setSyncing(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/discord-role-mappings/backfill", { method: "POST" });
      const data = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(data.error || "Historical role sync failed.");
      const summary = `Processed ${data.syncedGuilds} of ${data.totalGuilds} subscribed guilds.`;
      if (data.failedGuilds) {
        setError(`${summary} ${data.failedGuilds} guild(s) failed. Run the sync again after resolving the reported issue.`);
      } else {
        setNotice(`${summary} Existing eligible members have been reconciled.`);
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Historical role sync failed."); }
    finally { setSyncing(false); }
  }

  return (
    <section className="mt-6 space-y-5">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-base font-semibold">Connection requirements</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">The bot must be installed in the official HMDL server with Manage Roles permission. Its highest role must be positioned above every subscription role it needs to assign. Configure DISCORD_BOT_TOKEN and DISCORD_OFFICIAL_GUILD_ID in the deployment environment.</p>
        <button type="button" onClick={() => void load()} className="mt-4 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">Refresh Discord roles</button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 className="text-base font-semibold">Historical role synchronization</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Run a one-time backfill for all guilds with ACTIVE or TRIALING subscriptions. Existing HMDL members will receive the mapped roles they currently qualify for; stale mapped roles are reconciled as well.</p></div>
          <button type="button" disabled={syncing || loading} onClick={() => void runHistoricalSync()} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50">{syncing ? "Synchronizing…" : "Sync existing subscribers"}</button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-semibold">Subscription role mappings</h2>
        <p className="mt-1 text-sm text-zinc-400">Each active plan can map to one existing Discord role. Future plans such as Trial or Free can be added here without code changes.</p>
        {loading ? <p className="mt-5 text-sm text-zinc-500">Loading configuration…</p> : (
          <>
            {mappings.length ? <div className="mt-4 divide-y divide-zinc-800">
              {mappings.map((mapping) => <div key={mapping.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div><p className="font-medium">{mapping.plan.name}</p><p className="text-sm text-zinc-500">Discord role: {mapping.discordRoleName} · <span className="font-mono">{mapping.discordRoleId}</span></p></div>
                <button type="button" onClick={() => void remove(mapping.planId)} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-800 hover:text-red-300">Remove</button>
              </div>)}
            </div> : <p className="mt-4 text-sm text-zinc-500">No subscription roles mapped yet.</p>}
            <div className="mt-5 grid gap-3 border-t border-zinc-800 pt-5 md:grid-cols-[1fr_1fr_auto]">
              <label className="text-sm text-zinc-400">HMDL plan<select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"><option value="">Select plan</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
              <label className="text-sm text-zinc-400">Existing Discord role<select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"><option value="">Select role</option>{roles.sort((a,b) => b.position-a.position).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
              <button type="button" disabled={!selectedPlan || !selectedRole || saving} onClick={() => void save()} className="self-end rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50">{saving ? "Saving…" : "Save mapping"}</button>
            </div>
          </>
        )}
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-300">{notice}</p>}
      </div>
    </section>
  );
}
