import { redirect } from "next/navigation";
import ManagementPageHeader from "@/app/ManagementPageHeader";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import AdminImpersonationClient from "./AdminImpersonationClient";

export const dynamic = "force-dynamic";

export default async function AdminImpersonationPage({ searchParams }: { searchParams: Promise<{ guildId?: string; userId?: string }> }) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/login");
  const params = await searchParams;
  const [guilds, users, sessions] = await Promise.all([
    prisma.guild.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, gameType: true, owner: { select: { username: true } } } }),
    prisma.user.findMany({ orderBy: { username: "asc" }, select: { id: true, username: true, discordId: true } }),
    prisma.adminImpersonationSession.findMany({ orderBy: { startedAt: "desc" }, take: 100, include: { auditLogs: { orderBy: { createdAt: "desc" }, take: 1 } } }),
  ]);
  const userIds = [...new Set(sessions.flatMap((session) => [session.adminUserId, session.targetUserId]))];
  const guildIds = [...new Set(sessions.map((session) => session.guildId))];
  const [sessionUsers, sessionGuilds] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } }),
    prisma.guild.findMany({ where: { id: { in: guildIds } }, select: { id: true, name: true } }),
  ]);
  const userNames = new Map(sessionUsers.map((user) => [user.id, user.username]));
  const guildNames = new Map(sessionGuilds.map((guild) => [guild.id, guild.name]));
  const rows = sessions.map((session) => ({
    id: session.id, mode: session.mode, role: session.role, guildName: guildNames.get(session.guildId) ?? "Deleted guild",
    adminName: userNames.get(session.adminUserId) ?? "Unknown admin", targetName: userNames.get(session.targetUserId) ?? "Deleted user",
    startedAt: session.startedAt.toISOString(), expiresAt: session.expiresAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null, endedReason: session.endedReason,
  }));
  return <main className="hmdl-platform-admin-workspace min-h-screen bg-zinc-950 text-white"><div className="hmdl-page"><ManagementPageHeader eyebrow="PLATFORM · SUPPORT & TESTING" title="Impersonation" description="Temporarily preview Heimdall through a guild user’s account or simulate a guild role without changing your administrator account." /><div className="mt-6"><AdminImpersonationClient guilds={guilds.map((guild) => ({ id: guild.id, name: guild.name, gameType: guild.gameType, ownerName: guild.owner?.username ?? null }))} users={users} sessions={rows} initialGuildId={params.guildId} initialUserId={params.userId} /></div></div></main>;
}
