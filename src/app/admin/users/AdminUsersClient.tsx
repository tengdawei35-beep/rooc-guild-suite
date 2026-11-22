"use client";
import { useMemo, useState } from "react";
import Link from "next/link";

type UserRow = {
  id: string; discordId: string; username: string; avatarUrl: string | null;
  createdAt: string; updatedAt: string; guildCount: number; characterCount: number;
  activeCharacterCount: number; ownedGuildCount: number; membershipCount: number;
  guilds: {
    id: string; name: string; gameType: "ROOC" | "RO3"; discordGuildId: string;
    roles: string[]; isOwner: boolean;
    characters: { name: string; job: string | null; active: boolean }[];
    memberRecords: number; activeMemberRecords: number;
  }[];
};

const controlClass = "min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500";
const formatDate = (value: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));

export default function AdminUsersClient({ users }: { users: UserRow[] }) {
  const [query, setQuery] = useState("");
  const [guildFilter, setGuildFilter] = useState("ALL");
  const [gameFilter, setGameFilter] = useState("ALL");
  const [affiliationFilter, setAffiliationFilter] = useState("ALL");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const guildOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) for (const guild of user.guilds) map.set(guild.id, guild.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [users]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((user) => {
      const searchable = [user.username, user.discordId, user.id, ...user.guilds.flatMap((guild) => [
        guild.name, guild.discordGuildId, ...guild.characters.flatMap((character) => [character.name, character.job ?? ""]),
      ])].join(" ").toLowerCase();
      const matchesQuery = !normalized || searchable.includes(normalized);
      const matchesGuild = guildFilter === "ALL" || user.guilds.some((guild) => guild.id === guildFilter);
      const matchesGame = gameFilter === "ALL" || user.guilds.some((guild) => guild.gameType === gameFilter);
      const matchesAffiliation = affiliationFilter === "ALL" ||
        (affiliationFilter === "NONE" ? user.guildCount === 0 :
          affiliationFilter === "MULTI" ? user.guildCount > 1 : user.guildCount === 1);
      return matchesQuery && matchesGuild && matchesGame && matchesAffiliation;
    });
  }, [users, query, guildFilter, gameFilter, affiliationFilter]);

  const clearFilters = () => { setQuery(""); setGuildFilter("ALL"); setGameFilter("ALL"); setAffiliationFilter("ALL"); };

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900" aria-label="All HMDL users">
      <div className="flex flex-col gap-2 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-semibold text-white">All users</h2><p className="mt-1 text-sm text-zinc-500">Accounts are listed once, even when they belong to multiple guilds.</p></div>
        <span className="text-xs tabular-nums text-zinc-500">{filtered.length.toLocaleString()} of {users.length.toLocaleString()} users</span>
      </div>
      <div className="grid gap-3 border-b border-zinc-800 p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(150px,190px)_150px_180px]">
        <label className="sr-only" htmlFor="admin-user-search">Search users</label>
        <input id="admin-user-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Discord username, ID, guild or character…" className={controlClass} />
        <select aria-label="Filter by guild" value={guildFilter} onChange={(event) => setGuildFilter(event.target.value)} className={controlClass}>
          <option value="ALL">All guilds</option>{guildOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select aria-label="Filter by game type" value={gameFilter} onChange={(event) => setGameFilter(event.target.value)} className={controlClass}>
          <option value="ALL">All games</option><option value="ROOC">ROO Classic</option><option value="RO3">RO3</option>
        </select>
        <select aria-label="Filter by affiliation" value={affiliationFilter} onChange={(event) => setAffiliationFilter(event.target.value)} className={controlClass}>
          <option value="ALL">All users</option><option value="SINGLE">One guild</option><option value="MULTI">Multiple guilds</option><option value="NONE">No guild</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="px-5 py-14 text-center"><p className="font-medium text-zinc-200">No matching users</p><p className="mt-1 text-sm text-zinc-500">Try changing or clearing the filters.</p><button onClick={clearFilters} className="mt-4 text-sm text-zinc-300 underline underline-offset-4">Clear filters</button></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="hmdl-table w-full min-w-[1050px]">
            <thead><tr><th scope="col">Discord user</th><th scope="col">Guild affiliation(s)</th><th scope="col">Characters</th><th scope="col">Account created</th><th scope="col">Last account update</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
            <tbody>{filtered.map((user) => {
              const expanded = expandedUserId === user.id;
              return <tr key={user.id}>
                <td><div className="flex items-center gap-3">
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full bg-zinc-800 object-cover" /> : <div aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300">{user.username.slice(0, 1).toUpperCase()}</div>}
                  <div className="min-w-0"><div className="font-medium text-zinc-100">{user.username}</div><div className="mt-1 font-mono text-xs text-zinc-500">{user.discordId}</div></div>
                </div></td>
                <td>{user.guilds.length === 0 ? <span className="text-sm text-zinc-500">No guild affiliation</span> : <div className="flex max-w-[440px] flex-wrap gap-1.5">
                  {user.guilds.slice(0, 3).map((guild) => <span key={guild.id} className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/70 px-2 py-1 text-xs text-zinc-300">{guild.name}<span className={guild.gameType === "RO3" ? "text-violet-300" : "text-zinc-500"}>{guild.gameType === "RO3" ? "RO3" : "Classic"}</span></span>)}
                  {user.guilds.length > 3 && <span className="px-1 py-1 text-xs text-zinc-500">+{user.guilds.length - 3} more</span>}
                </div>}
                  <div className="mt-1 text-xs text-zinc-500">{user.guildCount} guild{user.guildCount === 1 ? "" : "s"}{user.ownedGuildCount ? " · owner of " + user.ownedGuildCount : ""}</div>
                </td>
                <td><div className="font-medium tabular-nums text-zinc-200">{user.activeCharacterCount} active</div><div className="mt-1 text-xs text-zinc-500">{user.characterCount} linked total</div></td>
                <td className="text-zinc-400">{formatDate(user.createdAt)}</td><td className="text-zinc-400">{formatDate(user.updatedAt)}</td>
                <td className="text-right"><button type="button" aria-expanded={expanded} onClick={() => setExpandedUserId(expanded ? null : user.id)} className="rounded-md px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800">{expanded ? "Hide" : "Details"}</button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
      {expandedUserId && filtered.some((user) => user.id === expandedUserId) && <div className="border-t border-zinc-800 bg-zinc-950/50 p-5">
        {filtered.filter((user) => user.id === expandedUserId).map((user) => <div key={user.id} className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-white">{user.username}</h3><p className="mt-1 font-mono text-xs text-zinc-500">HMDL user ID: {user.id}</p></div><div className="text-xs text-zinc-500">{user.membershipCount} guild membership record{user.membershipCount === 1 ? "" : "s"}</div></div>
          {user.guilds.length === 0 ? <p className="text-sm text-zinc-500">This account is not currently linked to a guild.</p> : <div className="grid gap-3 md:grid-cols-2">
            {user.guilds.map((guild) => <div key={guild.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-medium text-zinc-100">{guild.name}</h4><span className="text-xs text-zinc-500">{guild.gameType === "RO3" ? "RO3" : "ROO Classic"}</span></div>
              <p className="mt-1 font-mono text-xs text-zinc-600">Discord guild ID: {guild.discordGuildId}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{guild.isOwner && <span className="rounded border border-amber-900/70 bg-amber-950/30 px-2 py-1 text-xs text-amber-300">Guild owner</span>}{guild.roles.map((role) => <span key={role} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300">{role}</span>)}{guild.roles.length === 0 && !guild.isOwner && <span className="text-xs text-zinc-500">Roster-linked only</span>}</div>
              <div className="mt-3 text-xs text-zinc-500">{guild.activeMemberRecords} active / {guild.memberRecords} roster records</div><Link href={`/admin/impersonation?guildId=${guild.id}&userId=${user.id}`} className="mt-3 inline-flex rounded-md border border-orange-900/70 px-2.5 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-950/50">View as this user</Link>
              {guild.characters.length > 0 && <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">{guild.characters.map((character, index) => <div key={character.name + "-" + index} className="flex items-center justify-between gap-3 text-sm"><span className="text-zinc-300">{character.name}<span className="ml-2 text-xs text-zinc-500">{character.job ?? "Class not set"}</span></span><span className={character.active ? "text-xs text-emerald-400" : "text-xs text-zinc-600"}>{character.active ? "Active" : "Inactive"}</span></div>)}</div>}
            </div>)}
          </div>}
        </div>)}
      </div>}
      <div className="border-t border-zinc-800 px-5 py-3 text-xs text-zinc-600">Guild affiliations combine explicit guild memberships, linked roster records and guild ownership. Discord IDs are shown as account identifiers; no email or billing data is exposed here.</div>
    </section>
  );
}