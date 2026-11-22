"use client";
import { useState } from "react";

type Guild = { id: string; name: string; gameType: string; ownerName: string | null };
type User = { id: string; username: string; discordId: string };
type Session = { id: string; mode: string; role: string; guildName: string; adminName: string; targetName: string; startedAt: string; expiresAt: string; endedAt: string | null; endedReason: string | null };

const control = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-orange-500";
function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export default function AdminImpersonationClient({ guilds, users, sessions, initialGuildId, initialUserId }: {
  guilds: Guild[]; users: User[]; sessions: Session[]; initialGuildId?: string; initialUserId?: string;
}) {
  const [mode, setMode] = useState<"ROLE" | "USER">(initialUserId ? "USER" : "ROLE");
  const [guildId, setGuildId] = useState(initialGuildId ?? "");
  const [userId, setUserId] = useState(initialUserId ?? "");
  const [role, setRole] = useState("MANAGER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/impersonation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, guildId, userId: mode === "USER" ? userId : undefined, role: mode === "ROLE" ? role : undefined }),
      });
      const result = await response.json() as { error?: string; redirectTo?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to start impersonation.");
      window.location.assign(result.redirectTo ?? "/");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to start impersonation."); setBusy(false); }
  }

  const selectedGuild = guilds.find((guild) => guild.id === guildId);
  const selectableUsers = users.filter((user) => user.id && userId !== user.id ? true : true);

  return <div className="space-y-6">
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-orange-400">Temporary access · 30 minutes</p><h2 className="mt-2 text-xl font-semibold text-white">Start an impersonation session</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Your platform administrator identity remains intact. HMDL evaluates guild permissions using the selected user or simulated role, and records the session in the audit history.</p></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-zinc-300">Guild<select className={control+" mt-2"} value={guildId} onChange={(event) => setGuildId(event.target.value)}><option value="">Select a guild…</option>{guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name} · {guild.gameType}</option>)}</select></label>
        <label className="text-sm text-zinc-300">Access mode<select className={control+" mt-2"} value={mode} onChange={(event) => setMode(event.target.value as "ROLE" | "USER")}><option value="ROLE">Simulate a guild role</option><option value="USER">Impersonate an existing user</option></select></label>
        {mode === "ROLE" ? <label className="text-sm text-zinc-300 md:col-span-2">Role to preview<select className={control+" mt-2"} value={role} onChange={(event) => setRole(event.target.value)}><option value="ADMIN">Guild Owner</option><option value="MANAGER">Guild Manager</option><option value="OFFICER">Guild Officer</option><option value="MEMBER">Guild Member</option></select><span className="mt-1 block text-xs text-zinc-500">{role === "ADMIN" ? (selectedGuild?.ownerName ? "Uses the guild’s linked owner identity." : "This guild needs a linked owner account before owner preview can start.") : "Uses your platform-admin identity with the selected guild role permissions."}</span></label>
          : <label className="text-sm text-zinc-300 md:col-span-2">Existing guild user<select className={control+" mt-2"} value={userId} onChange={(event) => setUserId(event.target.value)}><option value="">Select a user…</option>{selectableUsers.map((user) => <option key={user.id} value={user.id}>{user.username} · {user.discordId}</option>)}</select><span className="mt-1 block text-xs text-zinc-500">Only users with a membership in the selected guild can be impersonated.</span></label>}
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" disabled={busy || !guildId || (mode === "USER" && !userId) || (mode === "ROLE" && role === "ADMIN" && !selectedGuild?.ownerName)} onClick={start} className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Starting…" : "Start impersonation"}</button><span className="text-xs text-zinc-500">Read and write permissions match the selected role. Sensitive platform administration and billing controls remain unavailable.</span></div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-5 py-4"><h2 className="font-semibold text-white">Session history</h2><p className="mt-1 text-sm text-zinc-500">Recent impersonation sessions and their termination status.</p></div>
      {sessions.length ? <div className="overflow-x-auto"><table className="hmdl-table w-full min-w-[900px]"><thead><tr><th>Guild / role</th><th>Target identity</th><th>Started by</th><th>Started</th><th>Expiry</th><th>Status</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td><div className="font-medium text-zinc-100">{session.guildName}</div><div className="mt-1 text-xs text-zinc-500">{session.mode === "ROLE" && session.role === "ADMIN" ? "Guild Owner" : session.role} · {session.mode === "USER" ? "User impersonation" : "Role simulation"}</div></td><td className="text-zinc-300">{session.targetName}</td><td className="text-zinc-400">{session.adminName}</td><td className="text-zinc-400">{date(session.startedAt)}</td><td className="text-zinc-400">{date(session.expiresAt)}</td><td><span className={`rounded-full border px-2 py-1 text-xs ${session.endedAt ? "border-zinc-700 text-zinc-400" : new Date(session.expiresAt) <= new Date() ? "border-amber-900 text-amber-300" : "border-emerald-900 text-emerald-300"}`}>{session.endedAt ? session.endedReason ?? "Ended" : new Date(session.expiresAt) <= new Date() ? "Expired" : "Active"}</span></td></tr>)}</tbody></table></div> : <p className="px-5 py-10 text-center text-sm text-zinc-500">No impersonation sessions have been recorded yet.</p>}
    </section>
  </div>;
}
