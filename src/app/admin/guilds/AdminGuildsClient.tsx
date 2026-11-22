"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type GuildRow = {
  id: string;
  name: string;
  discordGuildId: string;
  gameType: "ROOC" | "RO3";
  ownerName: string | null;
  ownerDiscordId: string | null;
  activeMembers: number;
  totalMembers: number;
  linkedUsers: number;
  eventCount: number;
  planName: string | null;
  subscriptionStatus: string | null;
  provider: string | null;
  priceCents: number | null;
  currency: string | null;
  billingInterval: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
};

type PlanBreakdown = { name: string; count: number };

const selectClass = "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-500";
const statusStyles: Record<string, string> = {
  ACTIVE: "border-emerald-900 bg-emerald-950/40 text-emerald-400",
  TRIALING: "border-sky-900 bg-sky-950/40 text-sky-400",
  PAST_DUE: "border-amber-900 bg-amber-950/40 text-amber-400",
  CANCELED: "border-zinc-700 bg-zinc-900 text-zinc-400",
  INCOMPLETE: "border-zinc-700 bg-zinc-900 text-zinc-400",
  NONE: "border-zinc-700 bg-zinc-900 text-zinc-500",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatPrice(cents: number | null, currency: string | null, interval: string | null) {
  if (cents === null || !currency) return "—";
  const amount = new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(cents / 100);
  return `${amount} / ${interval === "YEAR" ? "yr" : "mo"}`;
}

export default function AdminGuildsClient({
  guilds,
  planBreakdown,
}: {
  guilds: GuildRow[];
  planBreakdown: PlanBreakdown[];
}) {
  const [query, setQuery] = useState("");
  const [gameFilter, setGameFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");

  const planNames = useMemo(() => [...new Set(guilds.map((guild) => guild.planName).filter((name): name is string => Boolean(name)))].sort(), [guilds]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return guilds.filter((guild) => {
      const matchesQuery = !normalized || [
        guild.name, guild.discordGuildId, guild.ownerName ?? "", guild.ownerDiscordId ?? "", guild.planName ?? "",
      ].some((value) => value.toLowerCase().includes(normalized));
      const matchesGame = gameFilter === "ALL" || guild.gameType === gameFilter;
      const matchesStatus = statusFilter === "ALL" || (statusFilter === "NONE" ? !guild.subscriptionStatus : guild.subscriptionStatus === statusFilter);
      const matchesPlan = planFilter === "ALL" || (planFilter === "NONE" ? !guild.planName : guild.planName === planFilter);
      return matchesQuery && matchesGame && matchesStatus && matchesPlan;
    });
  }, [guilds, query, gameFilter, statusFilter, planFilter]);

  const maxPlanCount = Math.max(1, ...planBreakdown.map((item) => item.count));

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="flex flex-col gap-3 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-white">Guild portfolio</h2>
            <p className="mt-1 text-sm text-zinc-500">Every guild registered on HMDL, including complimentary and unsubscribed guilds.</p>
          </div>
          <span role="status" aria-live="polite" className="text-xs text-zinc-500">{filtered.length} of {guilds.length} guilds</span>
        </div>
        <div className="grid gap-3 border-b border-zinc-800 p-4 lg:grid-cols-[minmax(220px,1fr)_150px_170px_170px]">
          <label className="sr-only" htmlFor="guild-search">Search guilds</label>
          <input id="guild-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guild, Discord ID, owner or plan…" className={selectClass} />
          <select aria-label="Filter by game" value={gameFilter} onChange={(event) => setGameFilter(event.target.value)} className={selectClass}>
            <option value="ALL">All game types</option><option value="ROOC">ROO Classic</option><option value="RO3">RO3</option>
          </select>
          <select aria-label="Filter by subscription status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={selectClass}>
            <option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="TRIALING">Trialing</option><option value="PAST_DUE">Past due</option><option value="CANCELED">Canceled</option><option value="INCOMPLETE">Incomplete</option><option value="NONE">No subscription</option>
          </select>
          <select aria-label="Filter by plan" value={planFilter} onChange={(event) => setPlanFilter(event.target.value)} className={selectClass}>
            <option value="ALL">All plans</option><option value="NONE">No plan</option>{planNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="font-medium text-zinc-200">No matching guilds</p>
            <p className="mt-1 text-sm text-zinc-500">Try changing or clearing the filters.</p>
            <button type="button" onClick={() => { setQuery(""); setGameFilter("ALL"); setStatusFilter("ALL"); setPlanFilter("ALL"); }} className="mt-4 text-sm text-zinc-300 underline underline-offset-4">Clear filters</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="hmdl-table w-full min-w-[1240px]">
              <thead><tr>
                <th scope="col">Guild</th><th scope="col">Owner</th><th scope="col">Members</th><th scope="col">Subscription</th><th scope="col">Provider</th><th scope="col">Events</th><th scope="col">Renewal / expiry</th><th scope="col">Created</th><th scope="col">Last updated</th><th scope="col">Preview</th>
              </tr></thead>
              <tbody>
                {filtered.map((guild) => {
                  const status = guild.subscriptionStatus ?? "NONE";
                  return <tr key={guild.id}>
                    <td>
                      <div className="font-medium text-zinc-100">{guild.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500"><span className={`rounded border px-1.5 py-0.5 ${guild.gameType === "RO3" ? "border-violet-900 bg-violet-950/30 text-violet-300" : "border-zinc-700 bg-zinc-800 text-zinc-300"}`}>{guild.gameType === "RO3" ? "RO3" : "ROO Classic"}</span><span className="font-mono">{guild.discordGuildId}</span></div>
                    </td>
                    <td><div className="text-zinc-200">{guild.ownerName ?? "Unassigned"}</div><div className="mt-1 text-xs text-zinc-500">{guild.ownerDiscordId ?? "No owner linked"}</div></td>
                    <td><div className="font-medium text-zinc-100">{guild.activeMembers.toLocaleString()}</div><div className="mt-1 text-xs text-zinc-500">{guild.totalMembers.toLocaleString()} total · {guild.linkedUsers.toLocaleString()} linked</div></td>
                    <td>
                      <div className="text-zinc-200">{guild.planName ?? "No subscription"}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusStyles[status] ?? statusStyles.NONE}`}>{status.replaceAll("_", " ")}</span>
                        {guild.cancelAtPeriodEnd && <span className="text-[11px] text-amber-400">Cancels at period end</span>}
                      </div>
                      {guild.priceCents !== null && <div className="mt-1 text-xs text-zinc-500">{formatPrice(guild.priceCents, guild.currency, guild.billingInterval)}</div>}
                    </td>
                    <td className="capitalize text-zinc-400">{guild.provider === "complimentary" ? "Complimentary" : guild.provider ?? "—"}</td>
                    <td className="tabular-nums text-zinc-300">{guild.eventCount.toLocaleString()}</td>
                    <td className="text-zinc-400">{formatDate(guild.periodEnd)}</td>
                    <td className="text-zinc-400">{formatDate(guild.createdAt)}</td><td className="text-zinc-400">{formatDate(guild.updatedAt)}</td><td><Link href={`/admin/impersonation?guildId=${guild.id}`} className="rounded-md border border-orange-900/70 px-2.5 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-950/50">Preview roles</Link></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-zinc-800 px-5 py-3 text-xs text-zinc-600">Member counts use active guild roster records. Linked users are counted separately from roster entries.</div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-semibold text-white">Subscription plan mix</h2>
          <p className="mt-1 text-sm text-zinc-500">Latest subscription record per guild, including inactive records.</p>
          {planBreakdown.length === 0 ? <p className="mt-6 text-sm text-zinc-500">No plan data available.</p> : <div className="mt-5 space-y-4">
            {planBreakdown.map((item) => <div key={item.name}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="text-zinc-300">{item.name}</span><span className="tabular-nums text-zinc-400">{item.count}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-sky-500" style={{ width: `${(item.count / maxPlanCount) * 100}%` }} /></div>
            </div>)}
          </div>}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-semibold text-white">Operational notes</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
            <li><span className="text-zinc-200">Game type</span> reflects the guild’s configured HMDL game module (ROO Classic or RO3).</li>
            <li><span className="text-zinc-200">Subscription</span> shows the most recently created subscription record for each guild. A guild with no record is shown as unsubscribed.</li>
            <li><span className="text-zinc-200">Complimentary access</span> is identified by its provider and is not treated as paid revenue.</li>
            <li><span className="text-zinc-200">Last updated</span> reflects the most recent guild record update; event totals are all-time counts. This overview is read-only.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
