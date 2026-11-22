import { redirect } from "next/navigation";

import ManagementPageHeader from "@/app/ManagementPageHeader";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import AdminGuildsClient from "./AdminGuildsClient";

export const dynamic = "force-dynamic";

export default async function AdminGuildsPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/login");

  const guilds = await prisma.guild.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      owner: { select: { username: true, discordId: true } },
      subscriptions: {
        orderBy: [{ createdAt: "desc" }],
        take: 1,
        include: { plan: { select: { name: true, priceCents: true, currency: true, billingInterval: true } } },
      },
      _count: {
        select: {
          members: true,
          memberships: true,
          events: true,
        },
      },
      members: { where: { active: true }, select: { id: true, userId: true } },
    },
  });

  const rows = guilds.map((guild) => {
    const subscription = guild.subscriptions[0] ?? null;
    return {
      id: guild.id,
      name: guild.name,
      discordGuildId: guild.discordGuildId,
      gameType: guild.gameType,
      ownerName: guild.owner?.username ?? null,
      ownerDiscordId: guild.owner?.discordId ?? null,
      activeMembers: guild.members.length,
      totalMembers: guild._count.members,
      linkedUsers: guild.members.filter((member) => member.userId !== null).length,
      eventCount: guild._count.events,
      planName: subscription?.plan.name ?? null,
      subscriptionStatus: subscription?.status ?? null,
      provider: subscription?.provider ?? null,
      priceCents: subscription?.plan.priceCents ?? null,
      currency: subscription?.plan.currency ?? null,
      billingInterval: subscription?.plan.billingInterval ?? null,
      periodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      createdAt: guild.createdAt.toISOString(),
      updatedAt: guild.updatedAt.toISOString(),
    };
  });

  const activeGuilds = rows.filter((guild) => guild.subscriptionStatus === "ACTIVE" || guild.subscriptionStatus === "TRIALING").length;
  const pastDueGuilds = rows.filter((guild) => guild.subscriptionStatus === "PAST_DUE").length;
  const complimentaryGuilds = rows.filter((guild) => guild.provider === "complimentary" && (guild.subscriptionStatus === "ACTIVE" || guild.subscriptionStatus === "TRIALING")).length;
  const unsubscribedGuilds = rows.filter((guild) => !guild.subscriptionStatus).length;
  const totalActiveMembers = rows.reduce((total, guild) => total + guild.activeMembers, 0);
  const roocGuilds = rows.filter((guild) => guild.gameType === "ROOC").length;
  const ro3Guilds = rows.filter((guild) => guild.gameType === "RO3").length;

  const planCounts = new Map<string, number>();
  for (const guild of rows) {
    if (guild.planName) planCounts.set(guild.planName, (planCounts.get(guild.planName) ?? 0) + 1);
  }
  const planBreakdown = [...planCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <main className="hmdl-platform-admin-workspace min-h-screen bg-zinc-950 text-white">
      <div className="hmdl-page">
        <ManagementPageHeader
          eyebrow="PLATFORM · GUILD PORTFOLIO"
          title="Guilds"
          description="A platform-wide view of every guild on HMDL, its game type, community size and subscription access."
        />

        <section aria-label="Guild portfolio summary" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Total guilds" value={rows.length} detail={`${roocGuilds} ROO Classic · ${ro3Guilds} RO3`} />
          <Summary label="Active subscriptions" value={activeGuilds} detail="Active or trialing" />
          <Summary label="Active roster members" value={totalActiveMembers} detail="Across all guilds" />
          <Summary label="Needs attention" value={pastDueGuilds + unsubscribedGuilds} detail={`${pastDueGuilds} past due · ${unsubscribedGuilds} no subscription`} />
        </section>

        <section aria-label="Guild access breakdown" className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Summary label="Complimentary access" value={complimentaryGuilds} detail="Active complimentary subscriptions" />
          <Summary label="ROO Classic guilds" value={roocGuilds} detail="Configured game type: ROOC" />
          <Summary label="RO3 guilds" value={ro3Guilds} detail="Configured game type: RO3" />
        </section>

        <div className="mt-6">
          <AdminGuildsClient guilds={rows} planBreakdown={planBreakdown} />
        </div>
      </div>
    </main>
  );
}

function Summary({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}
