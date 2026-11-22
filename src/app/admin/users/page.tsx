import { redirect } from "next/navigation";
import ManagementPageHeader from "@/app/ManagementPageHeader";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import AdminUsersClient from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/login");

  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true, discordId: true, username: true, avatarUrl: true, createdAt: true, updatedAt: true,
      guildMemberships: {
        select: { role: true, guild: { select: { id: true, name: true, gameType: true, discordGuildId: true } } },
      },
      guildMembers: {
        select: {
          id: true, characterName: true, job: true, active: true,
          guild: { select: { id: true, name: true, gameType: true, discordGuildId: true } },
        },
      },
      ownedGuilds: { select: { id: true, name: true, gameType: true, discordGuildId: true } },
    },
  });

  const rows = users.map((user) => {
    const guildMap = new Map<string, {
      id: string; name: string; gameType: "ROOC" | "RO3"; discordGuildId: string;
      roles: string[]; isOwner: boolean;
      characters: { name: string; job: string | null; active: boolean }[];
      memberRecords: number; activeMemberRecords: number;
    }>();
    const ensureGuild = (guild: { id: string; name: string; gameType: "ROOC" | "RO3"; discordGuildId: string }) => {
      let entry = guildMap.get(guild.id);
      if (!entry) {
        entry = { ...guild, roles: [], isOwner: false, characters: [], memberRecords: 0, activeMemberRecords: 0 };
        guildMap.set(guild.id, entry);
      }
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
      guildCount: guilds.length,
      characterCount: guilds.reduce((total, guild) => total + guild.characters.length, 0),
      activeCharacterCount: guilds.reduce((total, guild) => total + guild.characters.filter((character) => character.active).length, 0),
      ownedGuildCount: guilds.filter((guild) => guild.isOwner).length,
      membershipCount: user.guildMemberships.length,
    };
  });

  const summary = {
    totalUsers: rows.length,
    affiliatedUsers: rows.filter((user) => user.guildCount > 0).length,
    multiGuildUsers: rows.filter((user) => user.guildCount > 1).length,
    unaffiliatedUsers: rows.filter((user) => user.guildCount === 0).length,
    linkedCharacters: rows.reduce((total, user) => total + user.characterCount, 0),
  };

  return (
    <main className="hmdl-platform-admin-workspace min-h-screen bg-zinc-950 text-white">
      <div className="hmdl-page">
        <ManagementPageHeader eyebrow="PLATFORM · USER DIRECTORY" title="Users" description="A platform-wide directory of every HMDL account and its guild affiliations, independent of the currently selected guild." />
        <section aria-label="User directory summary" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Total users" value={summary.totalUsers} detail="Registered HMDL accounts" />
          <Summary label="Guild-affiliated" value={summary.affiliatedUsers} detail="Users linked to at least one guild" />
          <Summary label="Multiple guilds" value={summary.multiGuildUsers} detail="Users affiliated with 2+ guilds" />
          <Summary label="No guild affiliation" value={summary.unaffiliatedUsers} detail="Registered accounts without a guild link" />
        </section>
        <div className="mt-3"><Summary label="Linked characters" value={summary.linkedCharacters} detail="Character records linked to registered accounts across all guilds" /></div>
        <div className="mt-6"><AdminUsersClient users={rows} /></div>
      </div>
    </main>
  );
}

function Summary({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
    <p className="text-xs font-medium text-zinc-500">{label}</p>
    <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value.toLocaleString()}</p>
    <p className="mt-1 text-xs text-zinc-500">{detail}</p>
  </div>;
}