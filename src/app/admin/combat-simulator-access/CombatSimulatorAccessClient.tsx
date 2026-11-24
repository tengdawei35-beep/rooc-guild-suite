"use client";

import { useEffect, useState } from "react";

type UserOption = { id: string; username: string; discordId: string };
type GuildOption = { id: string; name: string; gameType: "ROOC" | "RO3"; discordGuildId: string };
type Grant = { id: string; status: string; createdAt: string; updatedAt: string };
type PersonalGrant = Grant & { user: UserOption };
type GuildGrant = Grant & { guild: GuildOption };
type Data = { users: UserOption[]; guilds: GuildOption[]; personalGrants: PersonalGrant[]; guildGrants: GuildGrant[] };

const fieldClass = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-zinc-500";
const active = (status: string) => status === "ACTIVE" || status === "TRIALING";
const date = (value: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));

export default function CombatSimulatorAccessClient() {
  const [data, setData] = useState<Data | null>(null);
  const [targetType, setTargetType] = useState<"USER" | "GUILD">("USER");
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/combat-simulator-access", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Unable to load access records.");
    setData(payload);
  }

  useEffect(() => { refresh().catch((e) => setError(e.message)); }, []);

  async function submit(action: "grant" | "revoke", type: "USER" | "GUILD", id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/combat-simulator-access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetType: type, targetId: id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "The access change failed.");
      setNotice(action === "grant" ? "Combat Simulator access granted." : "Administrator access revoked.");
      if (action === "grant") setTargetId("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The access change failed.");
    } finally { setBusy(false); }
  }

  const options = targetType === "USER" ? data?.users ?? [] : data?.guilds ?? [];

  return <div className="space-y-6">
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <div><h2 className="text-lg font-semibold text-white">Grant complimentary access</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">Grant an individual HMDL account access across their guilds, or grant access to every member of a specific guild. Administrator grants are indefinite until revoked and do not require a paid Combat Simulator subscription.</p></div>
      <div className="mt-5 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end">
        <label className="block"><span className="mb-2 block text-xs font-medium text-zinc-400">Grant access to</span><select className={fieldClass} value={targetType} onChange={(e) => { setTargetType(e.target.value as "USER" | "GUILD"); setTargetId(""); }}><option value="USER">Individual user</option><option value="GUILD">Entire guild</option></select></label>
        <label className="block min-w-0"><span className="mb-2 block text-xs font-medium text-zinc-400">{targetType === "USER" ? "HMDL user" : "Guild"}</span><select className={fieldClass} value={targetId} onChange={(e) => setTargetId(e.target.value)}><option value="">Select {targetType === "USER" ? "a user" : "a guild"}…</option>{options.map((option) => <option key={option.id} value={option.id}>{targetType === "USER" ? (option as UserOption).username + " · " + (option as UserOption).discordId : (option as GuildOption).name + " · " + ((option as GuildOption).gameType === "RO3" ? "RO3" : "ROO Classic")}</option>)}</select></label>
        <button type="button" disabled={!targetId || busy} onClick={() => submit("grant", targetType, targetId)} className="min-h-[42px] rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Saving…" : "Grant access"}</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-900/70 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">{notice}</p>}
    </section>

    <section className="rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-5 py-4"><h2 className="font-semibold text-white">Individual user grants</h2><p className="mt-1 text-sm text-zinc-500">Access follows the account, regardless of which guild is selected.</p></div>
      {!data ? <p className="p-5 text-sm text-zinc-500">Loading access records…</p> : data.personalGrants.length === 0 ? <p className="p-5 text-sm text-zinc-500">No individual grants yet.</p> : <div className="divide-y divide-zinc-800">{data.personalGrants.map((grant) => <GrantRow key={grant.id} title={grant.user.username} detail={grant.user.discordId} grant={grant} busy={busy} onRevoke={() => submit("revoke", "USER", grant.id)} />)}</div>}
    </section>

    <section className="rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-5 py-4"><h2 className="font-semibold text-white">Guild grants</h2><p className="mt-1 text-sm text-zinc-500">All current and former members of the guild inherit this access. A complimentary guild grant does not require an active Basic or Total subscription.</p></div>
      {!data ? <p className="p-5 text-sm text-zinc-500">Loading access records…</p> : data.guildGrants.length === 0 ? <p className="p-5 text-sm text-zinc-500">No guild grants yet.</p> : <div className="divide-y divide-zinc-800">{data.guildGrants.map((grant) => <GrantRow key={grant.id} title={grant.guild.name} detail={grant.guild.gameType === "RO3" ? "RO3" : "ROO Classic"} grant={grant} busy={busy} onRevoke={() => submit("revoke", "GUILD", grant.id)} />)}</div>}
    </section>
  </div>;
}

function GrantRow({ title, detail, grant, busy, onRevoke }: { title: string; detail: string; grant: Grant; busy: boolean; onRevoke: () => void }) {
  const enabled = active(grant.status);
  return <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0"><p className="font-medium text-zinc-100">{title}</p><p className="mt-1 text-xs text-zinc-500">{detail} · Granted {date(grant.createdAt)}</p></div>
    <div className="flex items-center gap-3"><span className={enabled ? "rounded-full border border-emerald-900 bg-emerald-950/40 px-2.5 py-1 text-xs text-emerald-300" : "rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-500"}>{enabled ? "Access active" : "Revoked"}</span>{enabled && <button type="button" disabled={busy} onClick={onRevoke} className="rounded-lg border border-red-900/70 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-950/40 disabled:opacity-40">Revoke</button>}</div>
  </div>;
}
