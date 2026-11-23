import Link from "next/link";
import { HMDL_MARK } from "@/lib/hmdl-brand";
import GettingStarted from "@/app/GettingStarted";
import RoleOnboarding from "@/app/RoleOnboarding";
import { prisma } from "@/lib/prisma";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { hasGuildModule, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";
import { getPlatformAdmin } from "@/lib/platform-admin";

const DISCORD_URL = "https://discord.gg/NrT2RKnh8M";
const SERVER_TIME_ZONE = "Asia/Bangkok";

function getZonedMidnightUtc(year: number, month: number, day: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const targetUtc = Date.UTC(year, month - 1, day);
  let guess = targetUtc;
  // Reconcile the desired local midnight with its UTC representation. Repeating
  // handles timezone offsets and daylight-saving transitions without a dependency.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    const representedUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    guess += targetUtc - representedUtc;
  }
  return new Date(guess);
}

function getTodayBounds(timeZone: string, now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map(part => [part.type, part.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: getZonedMidnightUtc(year, month, day, timeZone),
    end: getZonedMidnightUtc(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), timeZone),
  };
}

export default async function Home() {
  const auth = await getCurrentAuth();
  if (!auth) return <PublicLanding />;
  const accessibleGuildCount = await prisma.guildMembership.count({ where: { userId: auth.user.id } });
  const isPlatformAdmin = Boolean(await getPlatformAdmin());
  const hasResourceSuite = await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE);
  const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, include: { members: { where: { active: true }, orderBy: { updatedAt: "desc" }, take: 6 }, resources: { where: { active: true } }, reservedAllocations: true, allocationRuns: { orderBy: { createdAt: "desc" }, take: 5, include: { event: true, bidPages: true } }, events: { orderBy: { date: "desc" }, take: 5, include: { rosters: true } }, _count: { select: { members: { where: { active: true } } } } } });
  const canViewAllocation = hasResourceSuite && hasPermission(auth.role, "allocation.view");
  const canViewApplicants = hasPermission(auth.role, "applicants.view");
  const ownMember = await prisma.guildMember.findFirst({ where: { guildId: auth.guild.id, active: true, OR: [{ userId: auth.user.id }, { discordUserId: auth.user.discordId }] }, select: { id: true, characterName: true } });

  if (auth.role === "MEMBER") {
    const upcomingEvents = await prisma.event.findMany({
      where: { guildId: auth.guild.id, date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 6,
      include: {
        attendance: ownMember ? { where: { memberId: ownMember.id }, select: { status: true } } : false,
      },
    });

    return <main className="hmdl-member-home">
      <div className="hmdl-member-page">\n        <RoleOnboarding />
        <header className="hmdl-member-welcome">
          <div>
            <p className="hmdl-eyebrow">MEMBER PORTAL</p>
            <h1>Welcome back, {auth.user.username}</h1>
            <p>Your guild activity, upcoming events and personal details in one place.</p>
          </div>
          <Link href="/events" className="hmdl-primary-action">View all events <span aria-hidden="true">→</span></Link>
        </header>

        <section className="hmdl-member-summary" aria-label="Your guild profile">
          <div className="hmdl-member-identity">
            <span className="hmdl-member-avatar" aria-hidden="true">{(ownMember?.characterName || auth.user.username).slice(0, 1).toUpperCase()}</span>
            <div>
              <span className="hmdl-summary-label">YOUR CHARACTER</span>
              <strong>{ownMember?.characterName || "Profile not linked"}</strong>
              <span>{ownMember ? "Your character is linked to this account." : "Ask guild management to link your character."}</span>
            </div>
          </div>
          <div className="hmdl-member-actions">
            {ownMember && <Link href={`/guild/members/${ownMember.id}`}>View profile <span aria-hidden="true">↗</span></Link>}
            {ownMember && <Link href={`/guild/members/ocr?memberId=${ownMember.id}`}>Update stats <span aria-hidden="true">↗</span></Link>}
            <Link href="/guild/members/leave">Apply for leave <span aria-hidden="true">↗</span></Link>
          </div>
        </section>

        <section className="hmdl-member-section">
          <div className="hmdl-section-heading">
            <div><p className="hmdl-eyebrow">YOUR SCHEDULE</p><h2>Upcoming events</h2><p>See what's coming up and check your attendance response.</p></div>
            <Link href="/events" className="hmdl-text-link">All events <span aria-hidden="true">→</span></Link>
          </div>
          {upcomingEvents.length ? <div className="hmdl-upcoming-list">
            {upcomingEvents.map((event) => {
              const status = event.attendance[0]?.status ?? null;
              return <Link href={`/events/${event.id}`} key={event.id} className="hmdl-upcoming-event">
                <div className="hmdl-event-date"><strong>{new Intl.DateTimeFormat("en", { day: "2-digit", timeZone: event.scheduleTimeZone || "Asia/Bangkok" }).format(event.date)}</strong><span>{new Intl.DateTimeFormat("en", { month: "short", timeZone: event.scheduleTimeZone || "Asia/Bangkok" }).format(event.date)}</span></div>
                <div className="hmdl-event-copy"><strong>{formatEventType(event.type, event.eventTypeName)}</strong><span>{new Intl.DateTimeFormat("en", { weekday: "long", hour: "numeric", minute: "2-digit", timeZone: event.scheduleTimeZone || "Asia/Bangkok" }).format(event.date)} · {event.scheduleTimeZone || "Guild time"}</span></div>
                <span className={`hmdl-attendance-status ${status ? "has-response" : ""}`}>{status ? status.replaceAll("_", " ") : "Response needed"}</span>
                <span className="hmdl-event-arrow" aria-hidden="true">→</span>
              </Link>;
            })}
          </div> : <div className="hmdl-member-empty"><strong>No upcoming events</strong><span>New guild events will appear here when they are scheduled.</span></div>}
        </section>

        <section className="hmdl-member-shortcuts">
          <Link href="/guild/members" className="hmdl-shortcut-card"><span className="hmdl-shortcut-icon" aria-hidden="true">♧</span><strong>Guild members</strong><span>Browse your guild directory.</span><span className="hmdl-shortcut-arrow" aria-hidden="true">→</span></Link>
          <Link href="/guild/members/leave" className="hmdl-shortcut-card"><span className="hmdl-shortcut-icon" aria-hidden="true">◷</span><strong>Leave & availability</strong><span>Submit or review your leave.</span><span className="hmdl-shortcut-arrow" aria-hidden="true">→</span></Link>
          {ownMember && <Link href={`/guild/members/${ownMember.id}`} className="hmdl-shortcut-card"><span className="hmdl-shortcut-icon" aria-hidden="true">◎</span><strong>My profile</strong><span>View your character information.</span><span className="hmdl-shortcut-arrow" aria-hidden="true">→</span></Link>}
        </section>
      </div>
    </main>;
  }

  const configuredTimeZone = guild?.timeZone || SERVER_TIME_ZONE;
  let dashboardTimeZone = SERVER_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: configuredTimeZone });
    dashboardTimeZone = configuredTimeZone;
  } catch {
    // Keep the dashboard available if a legacy or manually edited timezone is invalid.
  }
  const { start: todayStart, end: tomorrowStart } = getTodayBounds(dashboardTimeZone);
  const activeMemberCount = guild?._count.members ?? 0;
  const membersOnLeaveToday = guild ? await prisma.memberLeave.count({ where: { member: { guildId: guild.id, active: true }, date: { gte: todayStart, lt: tomorrowStart } } }) : 0;
  const availableToday = Math.max(0, activeMemberCount - membersOnLeaveToday);
  const applicantCount = canViewApplicants ? await prisma.guildApplicant.count({ where: { guildId: auth.guild.id, status: "PENDING" } }) : 0;
  const eventsToday = await prisma.event.count({ where: { guildId: auth.guild.id, date: { gte: todayStart, lt: tomorrowStart } } });
  const upcomingManagementEvents = hasPermission(auth.role, "events.view")
    ? await prisma.event.findMany({
        where: { guildId: auth.guild.id, date: { gte: new Date() } },
        orderBy: { date: "asc" },
        take: 5,
        include: { _count: { select: { attendance: true, rosters: true } } },
      })
    : [];

  const memberActivity = (guild?.members ?? []).map((member) => ({ date: member.updatedAt, title: member.characterName || member.discordUsername || "Member", detail: member.job ? `Member profile updated · ${member.job}` : "Member profile updated", href: `/guild/members/${member.id}` }));
  const leaveActivity = guild ? await prisma.memberLeave.findMany({ where: { member: { guildId: guild.id } }, orderBy: { createdAt: "desc" }, take: 5, include: { member: { select: { id: true, characterName: true, discordUsername: true } } } }) : [];

  const rosterActivity = (guild?.events ?? []).map((event) => {
    const rosters = event.rosters ?? [];
    const latestRoster = rosters.reduce<Date | null>((latest, roster) => !latest || roster.createdAt > latest ? roster.createdAt : latest, null);
    return latestRoster ? { date: latestRoster, title: "Roster generated", detail: `${formatEventType(event.type, event.eventTypeName)} · ${formatEventDate(event.date)}`, href: `/events/${event.id}` } : null;
  }).filter((item): item is { date: Date; title: string; detail: string; href: string } => item !== null);

  const eventActivityMap = new Map<string, { date: Date; title: string; detail: string; href: string }>();
  for (const item of rosterActivity) {
    const event = (guild?.events ?? []).find((candidate) => `/events/${candidate.id}` === item.href);
    if (!event) continue;
    eventActivityMap.set(event.id, { date: item.date, title: "Roster generated", detail: item.detail, href: item.href });
  }
  for (const run of guild?.allocationRuns ?? []) {
    if (run.bidPages.length === 0 || !run.event) continue;
    const eventId = run.event.id;
    const existing = eventActivityMap.get(eventId);
    const bidItem = { date: run.createdAt, title: "Bidding generated", detail: `${formatEventType(run.event.type, run.event.eventTypeName)} · ${formatEventDate(run.event.date)} · ${run.bidPages.length} page${run.bidPages.length === 1 ? "" : "s"}`, href: `/allocation/${run.id}/bids` };
    if (existing) {
      eventActivityMap.set(eventId, { date: existing.date >= bidItem.date ? existing.date : bidItem.date, title: "Event updated", detail: `${formatEventType(run.event.type, run.event.eventTypeName)} · ${formatEventDate(run.event.date)} · Roster + Bidding`, href: bidItem.href });
    } else {
      eventActivityMap.set(eventId, bidItem);
    }
  }
  const recentRosterActivity = Array.from(eventActivityMap.values()).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

  const applicantRecords = canViewApplicants ? await prisma.guildApplicant.findMany({ where: { guildId: auth.guild.id }, orderBy: { createdAt: "desc" }, take: 10, select: { characterName: true, discordUsername: true, status: true, createdAt: true, decidedAt: true } }) : [];
  const applicantActivity = applicantRecords.flatMap((applicant) => { const name = applicant.characterName || applicant.discordUsername || "Applicant"; const applied = [{ date: applicant.createdAt, title: name, detail: "Application submitted", href: "/guild/applicants" }]; if (!applicant.decidedAt || applicant.status === "PENDING") return applied; const decision = applicant.status === "ACCEPTED" ? "Application accepted" : "Application rejected"; return [...applied, { date: applicant.decidedAt, title: name, detail: decision, href: "/guild/applicants" }]; });
  const leaveItems = leaveActivity.map((leave) => ({ date: leave.createdAt, title: leave.member.characterName || leave.member.discordUsername || "Member", detail: "Leave recorded", href: `/guild/members/${leave.member.id}` }));
  const recentMemberActivity = memberActivity.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);
  const recentLeaveActivity = leaveItems.slice(0, 5);
  const recentApplicantActivity = applicantActivity.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);
  return <main className="hmdl-management-dashboard"><div className="hmdl-dashboard-page">{auth.role === "OFFICER" ? <RoleOnboarding /> : <GettingStarted />}
    <header className="hmdl-dashboard-heading"><div><p className="hmdl-eyebrow">MANAGEMENT WORKSPACE</p><h1>Guild overview</h1><p>Monitor guild activity and keep daily operations moving.</p></div><div className="flex items-center gap-3"><span className="max-w-40 truncate text-sm text-zinc-300">{auth.user.username}</span>{accessibleGuildCount > 1 && <Link href="/guild/switch" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white">Switch Guild</Link>}{isPlatformAdmin && <Link href="/admin" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white">Admin</Link>}<form action="/api/auth/logout" method="POST"><button type="submit" className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white">Log out</button></form></div></header>
      {!guild ? <section className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center"><h2 className="text-xl font-semibold">No guild configured</h2><p className="mt-2 text-sm text-zinc-400">Your ROO Guild Suite database is connected, but no guild has been created yet.</p><Link href="/guild" className="mt-6 inline-flex rounded-lg hmdl-btn hmdl-btn-primary px-5 py-3 font-medium">Configure Guild</Link></section> : <>
      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><CharacterCard ownMember={ownMember} /><StatCard label="Available today (not on leave)" value={availableToday} /><StatCard label="Num of Applicants" value={applicantCount} /><StatCard label="Events today" value={eventsToday} /></section>
      {hasPermission(auth.role, "events.view") && <section className="hmdl-management-section">
        <div className="hmdl-management-section-heading"><div><p className="hmdl-eyebrow">WHAT'S NEXT</p><h2>Upcoming operations</h2><p>Events scheduled for your guild.</p></div><Link href="/events" className="hmdl-text-link">Manage events →</Link></div>
        {upcomingManagementEvents.length ? <div className="hmdl-management-events">
          {upcomingManagementEvents.map((event) => <Link href={`/events/${event.id}`} key={event.id} className="hmdl-management-event">
            <div className="hmdl-management-event-date"><strong>{new Intl.DateTimeFormat("en", { day: "2-digit", timeZone: event.scheduleTimeZone || "Asia/Bangkok" }).format(event.date)}</strong><span>{new Intl.DateTimeFormat("en", { month: "short", timeZone: event.scheduleTimeZone || "Asia/Bangkok" }).format(event.date)}</span></div>
            <div className="hmdl-management-event-copy"><strong>{formatEventType(event.type, event.eventTypeName)}</strong><span>{new Intl.DateTimeFormat("en", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: event.scheduleTimeZone || "Asia/Bangkok" }).format(event.date)} · {event.scheduleTimeZone || "Guild time"}</span></div>
            <div className="hmdl-management-event-meta"><span>{event._count.attendance} attendance responses</span><span>{event._count.rosters} roster{event._count.rosters === 1 ? "" : "s"}</span></div>
            <span className="hmdl-event-arrow" aria-hidden="true">→</span>
          </Link>)}
        </div> : <div className="hmdl-member-empty"><strong>No upcoming events scheduled</strong><span>Create an event to start organizing your guild.</span><Link href="/events" className="hmdl-text-link">Open event management →</Link></div>}
      </section>}
      <section className="hmdl-management-section"><div className="hmdl-management-section-heading"><div><p className="hmdl-eyebrow">GUILD PULSE</p><h2>Recent activity</h2><p>Recent member, leave, applicant, roster and bidding activity.</p></div></div><div className="hmdl-dashboard-activity-grid"><ActivityList title="Member activity" tone="blue" items={recentMemberActivity} empty="No recent member activity." /><ActivityPanel title="Leave" tone="amber" items={recentLeaveActivity} empty="No leave records yet." />{canViewApplicants && <ActivityPanel title="Applicants" tone="violet" items={recentApplicantActivity} empty="No applicant activity yet." />}<ActivityPanel title="Roster & bidding" tone="teal" items={recentRosterActivity} empty="No rosters or bidding activity yet." /></div></section>
      {hasPermission(auth.role, "events.view") && <section className="mt-10"><div className="mb-4 flex items-end justify-between"><div><h2 className="text-lg font-semibold">Events & Rosters</h2><p className="mt-1 text-sm text-zinc-500">Manage events, generate rosters and organize parties.</p></div><Link href="/events" className="text-sm font-medium text-zinc-400 hover:text-white">View all →</Link></div><div className="hmdl-dashboard-group rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><CompactDashboardLink href="/events" title="Events" description="Create and manage Guild League and Emperium Overrun events." /><CompactDashboardLink href="/events?view=rosters" title="Rosters" description="View events with rosters, generate automatic rosters and manage party assignments." /><CompactDashboardLink href="/events?view=preferred" title="Preferred Rosters" description="Manage preferred roster arrangements used as the starting point for future events." /><CompactDashboardLink href="/guild/calls" title="Call To Arms" description="Create and join dungeon or event parties, fill required jobs and manage waitlists." /></div></div></section>}
      {(hasPermission(auth.role, "members.view") || hasPermission(auth.role, "users.view") || hasPermission(auth.role, "guild.manage") || canViewApplicants) && <section className="mt-10"><h2 className="mb-4 text-lg font-semibold">Guild Management</h2><div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{hasPermission(auth.role, "members.view") && <CompactDashboardLink href="/guild/members" title="Members" description="Manage guild members, eligibility, priority and character information." />}{hasPermission(auth.role, "members.view") && guild?.gameType !== "RO3" && <CompactDashboardLink href="/guild/rankings" title="Guild Rankings" description="Compare overall, DPS, Tank and PvP performance across the guild." />}{hasPermission(auth.role, "members.view") && <CompactDashboardLink href="/guild/statistics" title="Guild Statistics" description="View guild performance, member composition and activity statistics." />}{canViewApplicants && <CompactDashboardLink href="/guild/applicants" title="Applicants" description={guild?.gameType === "RO3" ? "Generate recruitment links and review RO3 applicant character stats." : "Generate recruitment links and review applicant ROOC stats, scores and projected guild percentile."} />}{guild?.gameType === "RO3" && ownMember && <CompactDashboardLink href="/guild/resources/opt-ins" title="My Resource Opt-ins" description="Choose the Cards, Equipment and Echoes you want for upcoming events." />}{canViewAllocation && <CompactDashboardLink href="/guild/resources" title="Resources" description="Manage resources and opt-in limits." />}{canViewAllocation && <CompactDashboardLink href="/guild/reservations" title="Reservations" description="Manage reserved resource allocations." />}{hasPermission(auth.role, "users.view") && <CompactDashboardLink href="/guild/users" title="Users" description="View Discord accounts and their guild access." />}{hasPermission(auth.role, "guild.manage") && <CompactDashboardLink href="/guild" title="Guild Settings" description="Configure your guild and Discord server." />}</div></div></section>}
      {canViewAllocation && <section className="mt-10"><h2 className="mb-4 text-lg font-semibold">Allocation</h2><div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><CompactDashboardLink href="/allocation" title="Allocation" description="Preview and run the next resource allocation." /><CompactDashboardLink href="/allocation/history" title="Allocation History" description="Review previous allocation runs, results and bidding pages." /><CompactDashboardLink href="/guild/resources/history" title="Resource Allocation History" description="See which resources were distributed to which members and when." />{hasResourceSuite && <CompactDashboardLink href="/bid-pages" title="Bid Pages" description="View active and previous bidding pages and find assigned slots." />}</div></div></section>}
    </>}</div></main>;
}

function PublicLanding() { return <main className="hmdl-public-entry hmdl-landing-page min-h-screen bg-zinc-950 text-white"><div className="hmdl-page mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10"><header className="flex items-center justify-between"><Link href="/" className="flex items-center gap-3 text-2xl font-bold tracking-tight"><img src={HMDL_MARK} alt="" className="h-12 w-12 rounded-lg object-contain" /><span>HMDL</span></Link><a href={DISCORD_URL} target="_blank" rel="noreferrer" className="text-sm text-zinc-400 transition hover:text-white">Discord ↗</a></header><section className="flex flex-1 flex-col justify-center py-16"><div className="mx-auto max-w-3xl text-center"><img src={HMDL_MARK} alt="HMDL — Heimdall Guild Management Suite" className="mx-auto mb-8 h-44 w-44 object-contain drop-shadow-[0_12px_40px_rgba(190,145,70,0.16)] sm:h-56 sm:w-56" /><p className="text-sm font-medium uppercase tracking-[0.35em] text-amber-300/70">HEIMDALL · GUILD MANAGEMENT SUITE</p><h1 className="mt-5 text-5xl font-bold tracking-tight sm:text-7xl">Guild management,<br />without the mess.</h1><p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">Manage members, events, rosters, resources, bidding and allocation in one place — built for modern guilds.</p></div><div className="mx-auto mt-14 grid w-full max-w-4xl gap-4 md:grid-cols-3"><LandingCard href="/pricing" title="New User" description="Explore HMDL packages and features, then get started with your guild." action="View packages →" /><LandingCard href="/login" title="Login" description="Already using HMDL? Sign in with Discord and continue to your guild." action="Continue with Discord →" /><a href={DISCORD_URL} target="_blank" rel="noreferrer" className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-7 transition hover:border-zinc-600 hover:bg-zinc-800"><div className="flex items-start justify-between gap-4"><h2 className="text-xl font-semibold">Discord</h2><span className="text-zinc-600 transition group-hover:translate-x-1 group-hover:text-zinc-300">↗</span></div><p className="mt-3 min-h-14 text-sm leading-6 text-zinc-400">Join the HMDL community for announcements, support, updates and discussion.</p><p className="mt-7 text-sm font-semibold text-white">Join HMDL Discord →</p></a></div></section><footer className="border-t border-zinc-900 py-5 text-center text-xs text-zinc-600">HMDL · Heimdall</footer></div></main>; }
function LandingCard({ href, title, description, action }: { href: string; title: string; description: string; action: string }) { return <Link href={href} className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-7 transition hover:border-zinc-600 hover:bg-zinc-800"><div className="flex items-start justify-between gap-4"><h2 className="text-xl font-semibold">{title}</h2><span className="text-zinc-600 transition group-hover:translate-x-1 group-hover:text-zinc-300">→</span></div><p className="mt-3 min-h-14 text-sm leading-6 text-zinc-400">{description}</p><p className="mt-7 text-sm font-semibold text-white">{action}</p></Link>; }
function CharacterCard({ ownMember }: { ownMember: { id: string; characterName: string | null } | null }) { return <div className="hmdl-dashboard-stat rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-sm text-zinc-500">Your Character</p><h2 className="mt-1 truncate text-xl font-semibold">{ownMember?.characterName ?? "Member profile"}</h2>{ownMember ? <div className="mt-4 flex flex-wrap gap-2"><Link href={`/guild/members/ocr?memberId=${ownMember.id}`} className="inline-flex w-fit rounded-lg hmdl-btn hmdl-btn-primary px-3 py-2 text-xs font-medium transition">Update stats →</Link><Link href="/guild/members/leave" className="inline-flex w-fit rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-white transition hover:border-zinc-500 hover:bg-zinc-800">Apply Leave</Link></div> : <Link href="/guild/members" className="mt-4 inline-flex w-fit rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-white transition hover:border-zinc-500 hover:bg-zinc-800">View profile</Link>}</div>; }
function CompactDashboardLink({ href, title, description }: { href: string; title: string; description: string }) { return <Link href={href} className="hmdl-dashboard-link group block rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 transition hover:border-zinc-600 hover:bg-zinc-800/60"><div className="flex items-start justify-between gap-3"><h3 className="font-medium">{title}</h3><span className="text-zinc-600 transition group-hover:translate-x-1 group-hover:text-zinc-300">→</span></div><p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p></Link>; }
function StatCard({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-sm text-zinc-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>; }
function ActivityList({ title, tone, items, empty }: { title: string; tone: "blue" | "amber" | "violet" | "teal"; items: { date: Date; title: string; detail: string; href: string }[]; empty: string }) { return <ActivityPanel title={title} tone={tone} items={items} empty={empty} />; }
function ActivityPanel({ title, tone, items, empty }: { title: string; tone: "blue" | "amber" | "violet" | "teal"; items: { date: Date; title: string; detail: string; href: string }[]; empty: string }) { return <section className={`hmdl-activity-card hmdl-activity-card--${tone}`} aria-label={title}><header className="hmdl-activity-card-header"><div className="hmdl-activity-card-heading"><span className="hmdl-activity-card-indicator" aria-hidden="true" /><h3>{title}</h3></div><span className="hmdl-activity-card-count">{items.length}</span></header>{items.length > 0 ? <ul className="hmdl-activity-list">{items.map((item, index) => <li key={`${item.href}-${item.date.getTime()}-${index}`}><Link href={item.href} className="hmdl-activity-row"><div className="hmdl-activity-row-copy"><p>{item.title}</p><span>{item.detail}</span></div><time dateTime={item.date.toISOString()}>{formatRelative(item.date)}</time><span className="hmdl-activity-row-arrow" aria-hidden="true">→</span></Link></li>)}</ul> : <p className="hmdl-activity-empty">{empty}</p>}</section>; }
function formatEventType(type: string, customName?: string | null) { if (type === "RO3_CUSTOM") return customName || "RO3 Event"; switch (type) { case "GUILD_LEAGUE": return "Guild League"; case "EMPERIUM_OVERRUN": return "Emperium Overrun"; default: return type; } }
function formatEventDate(date: Date) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(date); }
function formatDate(date: Date) { return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(date); }
function formatRelative(date: Date) { const diff = Date.now() - date.getTime(); const minutes = Math.floor(diff / 60000); if (minutes < 1) return "just now"; if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); if (days < 7) return `${days}d ago`; return formatDate(date); }