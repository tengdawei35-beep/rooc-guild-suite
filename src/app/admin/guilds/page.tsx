import { redirect } from "next/navigation";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import AdminGuildsClient from "./AdminGuildsClient";
import ManagementPageHeader from "@/app/ManagementPageHeader";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
type Params = { q?: string; game?: string; status?: string; plan?: string; page?: string };

export default async function AdminGuildsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/login");
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const game = params.game === "ROOC" || params.game === "RO3" ? params.game : "ALL";
  const validStatuses = ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELED", "INCOMPLETE"];
  const status = validStatuses.includes(params.status ?? "") || params.status === "NONE" ? params.status! : "ALL";
  const plan = params.plan ?? "ALL";
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const requestedPage = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  const values: unknown[] = [];
  const add = (value: unknown) => { values.push(value); return "$" + values.length; };
  const filters = ["TRUE"];
  if (query) {
    const p = add("%" + query + "%");
    filters.push('(g."name" ILIKE ' + p + ' OR g."discordGuildId" ILIKE ' + p + ' OR COALESCE(owner."username", \'\') ILIKE ' + p + ' OR COALESCE(owner."discordId", \'\') ILIKE ' + p + ' OR COALESCE(p."name", \'\') ILIKE ' + p + ')');
  }
  if (game !== "ALL") filters.push('g."gameType" = ' + add(game) + '::"GameType"');
  if (status === "NONE") filters.push('s."id" IS NULL');
  else if (status !== "ALL") filters.push('s."status" = ' + add(status) + '::"SubscriptionStatus"');
  if (plan === "NONE") filters.push('p."id" IS NULL');
  else if (plan !== "ALL") filters.push('p."name" = ' + add(plan));
  const cte = 'WITH latest AS (SELECT DISTINCT ON ("guildId") "id", "guildId", "planId", "status", "provider", "currentPeriodEnd", "cancelAtPeriodEnd" FROM "GuildSubscription" ORDER BY "guildId", "createdAt" DESC, "id" DESC) ';
  const joins = 'FROM "Guild" g LEFT JOIN latest s ON s."guildId" = g."id" LEFT JOIN "Plan" p ON p."id" = s."planId" LEFT JOIN "User" owner ON owner."id" = g."ownerUserId" ';
  const where = " WHERE " + filters.join(" AND ");
  const [countRows, summaryRows, planBreakdown] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ total: bigint }>>(cte + 'SELECT COUNT(*) AS total ' + joins + where, ...values),
    prisma.$queryRawUnsafe<Array<{ totalGuilds: bigint; activeSubscriptions: bigint; pastDueGuilds: bigint; complimentaryGuilds: bigint; unsubscribedGuilds: bigint; activeMembers: bigint; roocGuilds: bigint; ro3Guilds: bigint }>>(
      'WITH latest AS (SELECT DISTINCT ON ("guildId") "id", "guildId", "status", "provider" FROM "GuildSubscription" ORDER BY "guildId", "createdAt" DESC, "id" DESC) SELECT COUNT(*) AS "totalGuilds", COUNT(*) FILTER (WHERE s."status" IN (\'ACTIVE\', \'TRIALING\')) AS "activeSubscriptions", COUNT(*) FILTER (WHERE s."status" = \'PAST_DUE\') AS "pastDueGuilds", COUNT(*) FILTER (WHERE s."provider" = \'complimentary\' AND s."status" IN (\'ACTIVE\', \'TRIALING\')) AS "complimentaryGuilds", COUNT(*) FILTER (WHERE s."id" IS NULL) AS "unsubscribedGuilds", (SELECT COUNT(*) FROM "GuildMember" m WHERE m."active" = TRUE) AS "activeMembers", COUNT(*) FILTER (WHERE g."gameType" = \'ROOC\') AS "roocGuilds", COUNT(*) FILTER (WHERE g."gameType" = \'RO3\') AS "ro3Guilds" FROM "Guild" g LEFT JOIN latest s ON s."guildId" = g."id"'
    ),
    prisma.$queryRawUnsafe<Array<{ name: string; count: bigint }>>(
      'WITH latest AS (SELECT DISTINCT ON ("guildId") "guildId", "planId" FROM "GuildSubscription" ORDER BY "guildId", "createdAt" DESC, "id" DESC) SELECT p."name" AS name, COUNT(*) AS count FROM latest s JOIN "Plan" p ON p."id" = s."planId" GROUP BY p."name" ORDER BY count DESC, name ASC'
    ),
  ]);
  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const limit = add(PAGE_SIZE);
  const offset = add((page - 1) * PAGE_SIZE);
  const idRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    cte + 'SELECT g."id" ' + joins + where + ' ORDER BY g."createdAt" DESC, g."id" ASC LIMIT ' + limit + ' OFFSET ' + offset,
    ...values
  );
  const ids = idRows.map((row) => row.id);
  const [guildRecords, memberTotals, activeTotals, linkedTotals] = await Promise.all([
    ids.length ? prisma.guild.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, name: true, discordGuildId: true, gameType: true, createdAt: true, updatedAt: true,
        owner: { select: { username: true, discordId: true } },
        subscriptions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, include: { plan: { select: { name: true, priceCents: true, currency: true, billingInterval: true } } } },
        _count: { select: { events: true } },
      },
    }) : [],
    ids.length ? prisma.guildMember.groupBy({ by: ["guildId"], where: { guildId: { in: ids } }, _count: { _all: true } }) : Promise.resolve([]),
    ids.length ? prisma.guildMember.groupBy({ by: ["guildId"], where: { guildId: { in: ids }, active: true }, _count: { _all: true } }) : Promise.resolve([]),
    ids.length ? prisma.guildMember.groupBy({ by: ["guildId"], where: { guildId: { in: ids }, userId: { not: null } }, _count: { _all: true } }) : Promise.resolve([]),
  ]);
  const byId = new Map(guildRecords.map((g) => [g.id, g]));
  const totals = new Map(memberTotals.map((r) => [r.guildId, r._count._all]));
  const active = new Map(activeTotals.map((r) => [r.guildId, r._count._all]));
  const linked = new Map(linkedTotals.map((r) => [r.guildId, r._count._all]));
  const rows = ids.flatMap((id) => {
    const guild = byId.get(id);
    if (!guild) return [];
    const subscription = guild.subscriptions[0] ?? null;
    return [{
      id: guild.id, name: guild.name, discordGuildId: guild.discordGuildId, gameType: guild.gameType,
      ownerName: guild.owner?.username ?? null, ownerDiscordId: guild.owner?.discordId ?? null,
      activeMembers: active.get(id) ?? 0, totalMembers: totals.get(id) ?? 0, linkedUsers: linked.get(id) ?? 0,
      eventCount: guild._count.events, planName: subscription?.plan.name ?? null,
      subscriptionStatus: subscription?.status ?? null, provider: subscription?.provider ?? null,
      priceCents: subscription?.plan.priceCents ?? null, currency: subscription?.plan.currency ?? null,
      billingInterval: subscription?.plan.billingInterval ?? null, periodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false, createdAt: guild.createdAt.toISOString(), updatedAt: guild.updatedAt.toISOString(),
    }];
  });
  const s = summaryRows[0];
  const summary = {
    totalGuilds: Number(s?.totalGuilds ?? 0), activeSubscriptions: Number(s?.activeSubscriptions ?? 0),
    pastDueGuilds: Number(s?.pastDueGuilds ?? 0), complimentaryGuilds: Number(s?.complimentaryGuilds ?? 0),
    unsubscribedGuilds: Number(s?.unsubscribedGuilds ?? 0), activeMembers: Number(s?.activeMembers ?? 0),
    roocGuilds: Number(s?.roocGuilds ?? 0), ro3Guilds: Number(s?.ro3Guilds ?? 0),
  };
  return <main className="hmdl-platform-admin-workspace min-h-screen bg-zinc-950 text-white"><div className="hmdl-page">
    <ManagementPageHeader eyebrow="PLATFORM · GUILD PORTFOLIO" title="Guilds" description="A platform-wide view of every guild on HMDL, its game type, community size and subscription access." />
    <section aria-label="Guild portfolio summary" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Summary label="Total guilds" value={summary.totalGuilds} detail={summary.roocGuilds + " ROO Classic · " + summary.ro3Guilds + " RO3"} />
      <Summary label="Active subscriptions" value={summary.activeSubscriptions} detail="Active or trialing" />
      <Summary label="Active roster members" value={summary.activeMembers} detail="Across all guilds" />
      <Summary label="Needs attention" value={summary.pastDueGuilds + summary.unsubscribedGuilds} detail={summary.pastDueGuilds + " past due · " + summary.unsubscribedGuilds + " no subscription"} />
    </section>
    <section aria-label="Guild access breakdown" className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Summary label="Complimentary access" value={summary.complimentaryGuilds} detail="Active complimentary subscriptions" />
      <Summary label="ROO Classic guilds" value={summary.roocGuilds} detail="Configured game type: ROOC" />
      <Summary label="RO3 guilds" value={summary.ro3Guilds} detail="Configured game type: RO3" />
    </section>
    <div className="mt-6"><AdminGuildsClient guilds={rows} planBreakdown={planBreakdown.map((item) => ({ name: item.name, count: Number(item.count) }))} total={total} page={page} pageSize={PAGE_SIZE} filters={{ q: query, game, status, plan }} /></div>
  </div></main>;
}

function Summary({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs font-medium text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value.toLocaleString()}</p><p className="mt-1 text-xs text-zinc-500">{detail}</p></div>;
}