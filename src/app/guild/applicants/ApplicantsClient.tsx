"use client";

import { useEffect, useState } from "react";
import { RO3_STAT_FIELDS, RO3_STAT_LABELS, type RO3StatKey } from "@/lib/constants/ro3-stats";

type Applicant = {
  id: string;
  discordUsername: string;
  discordUserId: string;
  characterName: string;
  job: string | null;
  status: "PENDING" | "ACCEPTED" | "DENIED";
  watchlist: "GREEN" | "YELLOW" | "RED" | null;
  createdAt: string;
  ro3Stats: Record<string, number | null> | null;
  pdef: number | null;
  mdef: number | null;
  pvpDamageBonus: number | null;
  pvpDamageReduction: number | null;
  pdmgPercent: number | null;
  mdmgPercent: number | null;
  pdmgReductionPercent: number | null;
  mdmgReductionPercent: number | null;
  critRes: number | null;
  ignorePdef: number | null;
  ignoreMdef: number | null;
  damageVsMedium: number | null;
  damageReductionVsMedium: number | null;
  damageVsSmall: number | null;
  damageReductionVsSmall: number | null;
  damageVsDemiHuman: number | null;
  damageReductionVsDemiHuman: number | null;
  damageVsBrute: number | null;
  damageReductionVsBrute: number | null;
  equipmentPdefPercent: number | null;
  equipmentMdefPercent: number | null;
  patk: number | null;
  matk: number | null;
  hp: number | null;
  comparison: {
    scores: { dpsScore: number; tankScore: number; pvpScore: number; dpsPercentile: number; tankPercentile: number; pvpPercentile: number; rawPdef: number; rawMdef: number };
    closest: { characterName: string | null; job: string | null; dpsScore: number; tankScore: number; pvpScore: number; dpsPercentile: number; tankPercentile: number; pvpPercentile: number } | null;
  } | null;
};

type Invite = { id: string; token: string; active: boolean; createdAt: string; revokedAt: string | null };
type ComparisonScores = NonNullable<Applicant["comparison"]>["scores"];

export default function ApplicantsClient({ canManage }: { canManage: boolean }) {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [gameType, setGameType] = useState<"ROOC" | "RO3">("ROOC");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [processingApplicantId, setProcessingApplicantId] = useState<string | null>(null);
  const [expandedApplicantId, setExpandedApplicantId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const [applicationsResponse, invitesResponse] = await Promise.all([fetch("/api/guild/applicants"), fetch("/api/guild/applicants/invite")]);
      const applications = await applicationsResponse.json();
      const inviteData = await invitesResponse.json();
      if (!applicationsResponse.ok) throw new Error(applications.error ?? "Failed to load applicants.");
      if (!invitesResponse.ok) throw new Error(inviteData.error ?? "Failed to load application links.");
      setGameType(applications.gameType === "RO3" ? "RO3" : "ROOC");
      setApplicants(applications.applicants ?? []); setInvites(inviteData.invites ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load applicants."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function generateInvite() {
    setBusy(true); setError("");
    try { const response = await fetch("/api/guild/applicants/invite", { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Failed to generate link."); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to generate link."); }
    finally { setBusy(false); }
  }

  async function revokeInvite(id: string) {
    if (!window.confirm("Revoke this application link? Existing applications remain available.")) return;
    setBusy(true); setError("");
    try { const response = await fetch(`/api/guild/applicants/invite?id=${encodeURIComponent(id)}`, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Failed to revoke link."); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to revoke link."); }
    finally { setBusy(false); }
  }

  async function updateWatchlist(id: string, watchlist: "GREEN" | "YELLOW" | "RED" | null) {\n    setBusy(true); setError("");\n    try { const response = await fetch("/api/guild/applicants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, watchlist }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Failed to update watchlist."); await load(); }\n    catch (err) { setError(err instanceof Error ? err.message : "Failed to update watchlist."); }\n    finally { setBusy(false); }\n  }\n\n  async function decide(id: string, decision: "ACCEPTED" | "DENIED") {
    const applicant = applicants.find(item => item.id === id);
    const action = decision === "ACCEPTED" ? "accept" : "deny";
    const name = applicant?.characterName || applicant?.discordUsername || "this applicant";
    const confirmation = decision === "ACCEPTED"
      ? `Accept ${name} into the guild? This will create or update their guild member record.`
      : `Deny ${name}'s application? The application will remain in the recruitment history.`;
    if (!window.confirm(confirmation)) return;
    setBusy(true);
    setProcessingApplicantId(id);
    setError("");
    try {
      const response = await fetch("/api/guild/applicants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `Failed to ${action} applicant.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} applicant.`);
    } finally {
      setBusy(false);
      setProcessingApplicantId(null);
    }
  }

  const pendingCount = applicants.filter((applicant) => applicant.status === "PENDING").length;
  const acceptedCount = applicants.filter((applicant) => applicant.status === "ACCEPTED").length;
  const deniedCount = applicants.filter((applicant) => applicant.status === "DENIED").length;
  const activeInvites = invites.filter((invite) => invite.active);
  const [watchlistFilter, setWatchlistFilter] = useState<"ALL" | "GREEN" | "YELLOW" | "RED" | "UNSET">("ALL");
  const [search, setSearch] = useState("");
  const filteredApplicants = applicants.filter((applicant) => {
    const matchesWatchlist = watchlistFilter === "ALL" || (watchlistFilter === "UNSET" ? !applicant.watchlist : applicant.watchlist === watchlistFilter);
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [applicant.characterName, applicant.discordUsername, applicant.discordUserId, applicant.job ?? ""].some((value) => value.toLowerCase().includes(query));
    return matchesWatchlist && matchesSearch;
  });

  return <main className="hmdl-management hmdl-recruitment-page">
    <div className="hmdl-page">
      <header className="hmdl-recruitment-heading">
        <div>
          <p className="hmdl-eyebrow">PEOPLE / RECRUITMENT</p>
          <h1 className="hmdl-page-title">Applicants</h1>
          <p>Review pending {gameType} applications, compare character strength and manage recruitment decisions. Accepted and denied applications are automatically removed from this queue.</p>
        </div>
        {canManage && <button onClick={generateInvite} disabled={busy} className="hmdl-btn hmdl-btn-primary">{busy ? "Working…" : "＋ Generate application link"}</button>}
      </header>

      {error && <p role="alert" className="hmdl-recruitment-error">{error}</p>}
      {processingApplicantId && <p role="status" aria-live="polite" className="sr-only">Updating applicant decision…</p>}

      <section className="hmdl-recruitment-metrics" aria-label="Application summary">
        <div><span>Total applications</span><strong>{applicants.length}</strong></div>
        <div><span>Pending review</span><strong>{pendingCount}</strong></div>
        <div><span>Accepted</span><strong>{acceptedCount}</strong></div>
        <div><span>Denied</span><strong>{deniedCount}</strong></div>
      </section>

      {canManage && <section className="hmdl-recruitment-panel">
        <div className="hmdl-recruitment-panel-heading"><div><h2>Application links</h2><p>Share an active link with prospective guild members.</p></div><span className="hmdl-badge">{activeInvites.length} active</span></div>
        <div className="hmdl-invite-list">
          {activeInvites.map((invite) => <div key={invite.id} className="hmdl-invite-row">
            <div className="hmdl-invite-copy"><span>ACTIVE LINK</span><code>{typeof window !== "undefined" ? `${window.location.origin}/apply/${invite.token}` : `/apply/${invite.token}`}</code></div>
            <button onClick={() => revokeInvite(invite.id)} disabled={busy} className="hmdl-btn hmdl-btn-danger">Revoke link</button>
          </div>)}
          {activeInvites.length === 0 && <p className="hmdl-recruitment-empty-inline">No active application links. Generate one to begin recruiting.</p>}
        </div>
      </section>}

      <section className="hmdl-recruitment-panel hmdl-applicant-workspace">
        <div className="hmdl-recruitment-panel-heading"><div><h2>Application queue</h2><p>{loading ? "Loading applications…" : `Showing ${filteredApplicants.length} of ${applicants.length} applications`}</p></div><span className="hmdl-badge">{gameType} applicants</span></div>
        <div className="hmdl-applicant-toolbar">
          <input aria-label="Search applicants" className="hmdl-field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search character, Discord user or job…" />
          <select aria-label="Filter by application status" className="hmdl-field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="ACCEPTED">Accepted</option><option value="DENIED">Denied</option>
          </select>
        </div>
        <div className="hmdl-applicant-list">
          {loading ? <div className="hmdl-recruitment-empty">Loading applicants…</div> : filteredApplicants.length === 0 ? <div className="hmdl-recruitment-empty"><strong>{applicants.length === 0 ? "No applications yet" : "No matching applications"}</strong><span>{applicants.length === 0 ? "Applications submitted through your active recruitment link will appear here." : "Try another search or status filter."}</span></div> : filteredApplicants.map((applicant) => <article key={applicant.id} className={`hmdl-applicant-card ${expandedApplicantId === applicant.id ? "is-expanded" : ""}`}>
            <div className="hmdl-applicant-summary">
              <button type="button" onClick={() => setExpandedApplicantId(expandedApplicantId === applicant.id ? null : applicant.id)} className="hmdl-applicant-toggle" aria-expanded={expandedApplicantId === applicant.id}>
                <span className="hmdl-applicant-identity"><strong>{applicant.characterName}</strong><span>{applicant.job ?? "Job not specified"} · {applicant.discordUsername} · {applicant.discordUserId}</span><time dateTime={applicant.createdAt}>{new Date(applicant.createdAt).toLocaleDateString()}</time></span>
                <span className={`hmdl-badge ${applicant.status === "PENDING" ? "hmdl-badge-warning" : applicant.status === "ACCEPTED" ? "hmdl-badge-success" : "hmdl-badge-danger"}`}>{applicant.status}</span>\n                {applicant.watchlist && <span className={`hmdl-applicant-watchlist-badge is-${applicant.watchlist.toLowerCase()}`}>{applicant.watchlist === "GREEN" ? "Green · Prioritise" : applicant.watchlist === "YELLOW" ? "Yellow · Review" : "Red · Reject"}</span>}
                <span className="hmdl-applicant-expand">{expandedApplicantId === applicant.id ? "Hide details ↑" : "View details ↓"}</span>
              </button>
              {canManage && applicant.status === "PENDING" && <div className="hmdl-applicant-actions">{canManage && <select aria-label={`Watchlist for ${applicant.characterName}`} className="hmdl-field hmdl-applicant-watchlist-select" value={applicant.watchlist ?? ""} onChange={(event) => void updateWatchlist(applicant.id, (event.target.value || null) as "GREEN" | "YELLOW" | "RED" | null)} disabled={busy}><option value="">No watchlist</option><option value="GREEN">🟢 Green — Prioritise</option><option value="YELLOW">🟡 Yellow — Review</option><option value="RED">🔴 Red — Reject</option></select>}<button type="button" onClick={() => decide(applicant.id, "ACCEPTED")} disabled={busy} className="hmdl-btn hmdl-btn-primary">{processingApplicantId === applicant.id ? "Processing…" : "Accept"}</button><button type="button" onClick={() => decide(applicant.id, "DENIED")} disabled={busy} className="hmdl-btn hmdl-btn-danger">{processingApplicantId === applicant.id ? "Processing…" : "Deny"}</button></div>}
            </div>
            {expandedApplicantId === applicant.id && <div className="hmdl-applicant-details">
              {gameType === "ROOC" && applicant.comparison && <div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><ScorePanel title="Projected guild standing" scores={applicant.comparison.scores} /><div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"><h3 className="font-semibold">Closest current member</h3>{applicant.comparison.closest ? <><p className="mt-3 text-lg font-medium">{applicant.comparison.closest.characterName ?? "Unnamed"}</p><p className="text-xs text-zinc-500">{applicant.comparison.closest.job ?? "Job not specified"}</p><div className="mt-4 grid grid-cols-3 gap-3 text-center"><Metric label="PvP" value={applicant.comparison.closest.pvpScore} /><Metric label="DPS" value={applicant.comparison.closest.dpsScore} /><Metric label="Tank" value={applicant.comparison.closest.tankScore} /></div></> : <p className="mt-3 text-sm text-zinc-500">No active guild members available for comparison.</p>}</div></div>}
              {gameType === "RO3" ? <RO3StatsGrid stats={applicant.ro3Stats} /> : <StatsGrid applicant={applicant} />}
            </div>}
          </article>)}
        </div>
      </section>
    </div>
  </main>;
}

function ScorePanel({ title, scores }: { title: string; scores: ComparisonScores }) { return <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"><h3 className="font-semibold">{title}</h3><div className="mt-4 grid grid-cols-3 gap-3"><Metric label="PvP" value={scores.pvpScore} percentile={scores.pvpPercentile} /><Metric label="DPS" value={scores.dpsScore} percentile={scores.dpsPercentile} /><Metric label="Tank" value={scores.tankScore} percentile={scores.tankPercentile} /></div><p className="mt-4 text-xs text-zinc-500">RAW PDEF {scores.rawPdef.toFixed(2)} · RAW MDEF {scores.rawMdef.toFixed(2)}</p></div>; }

function StatsGrid({ applicant }: { applicant: Applicant }) {
  const sections = [
    {
      title: "Core Stats",
      items: [["PATK", applicant.patk], ["MATK", applicant.matk], ["HP", applicant.hp], ["PDEF", applicant.pdef], ["MDEF", applicant.mdef], ["Crit RES", applicant.critRes]],
    },
    {
      title: "PvP / Defense",
      items: [["PvP Damage Bonus", applicant.pvpDamageBonus], ["PvP Damage Reduction", applicant.pvpDamageReduction], ["Ignore PDEF", applicant.ignorePdef], ["Ignore MDEF", applicant.ignoreMdef], ["Equipment PDEF %", applicant.equipmentPdefPercent], ["Equipment MDEF %", applicant.equipmentMdefPercent]],
    },
    {
      title: "Damage Modifiers",
      items: [["Physical Damage %", applicant.pdmgPercent], ["Magic Damage %", applicant.mdmgPercent], ["Physical Damage Reduction %", applicant.pdmgReductionPercent], ["Magic Damage Reduction %", applicant.mdmgReductionPercent], ["Damage vs Medium", applicant.damageVsMedium], ["Reduction vs Medium", applicant.damageReductionVsMedium], ["Damage vs Small", applicant.damageVsSmall], ["Reduction vs Small", applicant.damageReductionVsSmall], ["Damage vs Demi-Human", applicant.damageVsDemiHuman], ["Reduction vs Demi-Human", applicant.damageReductionVsDemiHuman], ["Damage vs Brute", applicant.damageVsBrute], ["Reduction vs Brute", applicant.damageReductionVsBrute]],
    },
  ] as const;

  return <div className="grid gap-4 lg:grid-cols-3">{sections.map((section) => <div key={section.title} className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"><h3 className="font-semibold">{section.title}</h3><div className="mt-4 grid grid-cols-2 gap-2">{section.items.map(([label, value]) => <div key={label} className="rounded-lg border border-zinc-800 px-3 py-2"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-sm font-semibold">{formatStat(value)}</p></div>)}</div></div>)}</div>;
}


function RO3StatsGrid({ stats }: { stats: Record<string, number | null> | null }) {
  const groups = ["Core Stats", "Combat Modifiers", "Target Modifiers", "Special Dish"] as const;
  return <div className="grid gap-4 md:grid-cols-2">{groups.map(group => {
    const fields = RO3_STAT_FIELDS.filter(field => field.group === group);
    return <section key={group} className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"><h3 className="font-semibold">{group}</h3><div className="mt-4 grid grid-cols-2 gap-2">{fields.map(({ key }) => <div key={key} className="rounded-lg border border-zinc-800 px-3 py-2"><p className="text-xs text-zinc-500">{RO3_STAT_LABELS[key as RO3StatKey]}</p><p className="mt-1 text-sm font-semibold">{stats?.[key] == null ? "—" : formatStat(stats[key]!)}</p></div>)}</div></section>;
  })}</div>;
}

function formatStat(value: number | null) {
  return value === null || value === undefined ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function Metric({ label, value, percentile }: { label: string; value: number; percentile?: number }) { return <div className="rounded-lg border border-zinc-800 p-3 text-center"><p className="text-xs uppercase text-zinc-500">{label}</p><p className="mt-1 text-lg font-bold">{value.toFixed(2)}</p>{percentile !== undefined && <p className="mt-1 text-xs text-zinc-400">{percentile.toFixed(1)}th percentile</p>}</div>; }
