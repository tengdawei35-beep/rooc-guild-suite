import { redirect } from "next/navigation";
import ManagementPageHeader from "@/app/ManagementPageHeader";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import AdminUsersClient from "./AdminUsersClient";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/login");
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const requestedPage = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  const where = query ? {
    OR: [
      { username: { contains: query, mode: "insensitive" as const } },
      { discordId: { contains: query, mode: "insensitive" as const } },
      { id: { contains: query, mode: "insensitive" as const } },
      { guildMemberships: { some: { guild: { name: { contains: query, mode: "insensitive" as const } } } } },
      { guildMembers: { some: { OR: [
        { characterName: { contains: query, mode: "insensitive" as const } },
        { guild: { name: { contains: query, mode: "insensitive" as const } } },
      ] } } },
      { ownedGuilds: { some: { name: { contains: query, mode: "insensitive" as const } } } },
    ],
  } : {};
  const [total, summaryRows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.$queryRawUnsafe<Array<{ totalUsers: bigint; affiliatedUsers: bigint; multiGuildUsers: bigint; unaffiliatedUsers: bigint; linkedCharacters: bigint }>>(
      'SELECT COUNT(*) AS "totalUsers", COUNT(*) FILTER (WHERE COALESCE(a."guildCount", 0) > 0) AS "affiliatedUsers", COUNT(*) FILTER (WHERE COALESCE(a."guildCount", 0) > 1) AS "multiGuildUsers", COUNT(*) FILTER (WHERE COALESCE(a."guildCount", 0) = 0) AS "unaffiliatedUsers", (SELECT COUNT(*) FROM "GuildMember" m WHERE m."userId" IS NOT NULL) AS "linkedCharacters" FROM "User" u LEFT JOIN (SELECT affiliations."userId", COUNT(DISTINCT affiliations."guildId") AS "guildCount" FROM (SELECT "userId", "guildId" FROM "GuildMembership" UNION SELECT "userId", "guildId" FROM "GuildMember" WHERE "userId" IS NOT NULL UNION SELECT "ownerUserId" AS "userId", "id" AS "guildId" FROM "Guild" WHERE "ownerUserId" IS NOT NULL) affiliations GROUP BY affiliations."userId") a ON a."userId" = u."id"'
    ),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const users = await prisma.user.findMany({
    where, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    select: {
      id: true, discordId: true, username: true, avatarUrl: true, createdAt: true, updatedAt: true,
      guildMemberships: { select: { role: true, guild: { select: { id: true, name: true, gameType: true, discordGuildId: true } } } },
      guildMembers: { select: { id: true, characterName: true, job: true, active: true, guild: { select: { id: true, name: true, gameType: true, discordGuildId: true } } } },
      ownedGuilds: { select: { id: true, name: true, gameType: true, discordGuildId: true } },
    },
  });
  const rows = users.map((user) => {
    const guildMap = new Map<string, { id: string; name: string; gameType: "ROOC" | "RO3"; discordGuildId: string; roles: string[]; isOwner: boolean; characters: { name: string; job: string | null; active: boolean }[]; memberRecords: number; activeMemberRecords: number }>();
    const ensureGuild = (guild: { id: string; name: string; gameType: "ROOC" | "RO3"; discordGuildId: string }) => {
      let entry = guildMap.get(guild.id);
      if (!entry) { entry = { ...guild, roles: [], isOwner: false, characters: [], memberRecords: 0, activeMemberRecords: 0 }; guildMap.set(guild.id, entry); }
      return entry;
    };
    for (const membership of user.guildMemberships) {
      const entry = ensureGuild(membership.guild);
      if (!entry.roles.includes(membership.role)) entry.roles.push(membership.role);
    }
    for (const guild of user.ownedGuilds) ensureGuild(guild).isOwner = true;
    for (const member of user.guildMembers) {
      const entry = ensureGuild(member.guild);
      entry.memberRecords += 1;
      if (member.active) entry.activeMemberRecords += 1;
      if (member.characterName) entry.characters.push({ name: member.characterName, job: member.job, active: member.active });
    }
    const guilds = [...guildMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    return {
      id: user.id, discordId: user.discordId, username: user.username, avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(), guilds,
      guildCount: guilds.length, characterCount: guilds.reduce((n, g) => n + g.characters.length, 0),
      activeCharacterCount: guilds.reduce((n, g) => n + g.characters.filter((c) => c.active).length, 0),
      ownedGuildCount: guilds.filter((g) => g.isOwner).length, membershipCount: user.guildMemberships.length,
    };
  });
  const s = summaryRows[0];
  const summary = {
    totalUsers: Number(s?.totalUsers ?? 0), affiliatedUsers: Number(s?.affiliatedUsers ?? 0),
    multiGuildUsers: Number(s?.multiGuildUsers ?? 0), unaffiliatedUsers: Number(s?.unaffiliatedUsers ?? 0),
    linkedCharacters: Number(s?.linkedCharacters ?? 0),
  };
  return <main className="hmdl-platform-admin-workspace min-h-screen bg-zinc-950 text-white">
    <div className="hmdl-page">
      <ManagementPageHeader eyebrow="PLATFORM · USER DIRECTORY" title="Users" description="A platform-wide directory of every HMDL account and its guild affiliations, independent of the currently selected guild." />
      <section aria-label="User directory summary" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Total users" value={summary.totalUsers} detail="Registered HMDL accounts" />
        <Summary label="Guild-affiliated" value={summary.affiliatedUsers} detail="Users linked to at least one guild" />
        <Summary label="Multiple guilds" value={summary.multiGuildUsers} detail="Users affiliated with 2+ guilds" />
        <Summary label="No guild affiliation" value={summary.unaffiliatedUsers} detail="Registered accounts without a guild link" />
      </section>
      <div className="mt-3"><Summary label="Linked characters" value={summary.linkedCharacters} detail="Character records linked to registered accounts across all guilds" /></div>
      <div className="mt-6"><AdminUsersClient users={rows} total={total} page={page} pageSize={PAGE_SIZE} query={query} /></div>
    </div>
  </main>;
}

function Summary({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
    <p className="text-xs font-medium text-zinc-500">{label}</p>
    <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value.toLocaleString()}</p>
    <p className="mt-1 text-xs text-zinc-500">{detail}</p>
  </div>;
}