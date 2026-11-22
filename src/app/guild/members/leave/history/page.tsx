import ManagementPageHeader from "@/app/ManagementPageHeader";
import { redirect } from "next/navigation";
import { requirePageAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 25;

type SearchParams = Promise<{
  page?: string;
  q?: string;
  from?: string;
  to?: string;
}>;

type LeavePerson = {
  key: string;
  characterName: string;
  discordUsername: string | null;
  job: string | null;
  current: boolean;
  count: bigint;
  latest: Date;
};

type LeaveDate = {
  key: string;
  id: string;
  date: Date;
  reason: string | null;
};

type LeaveSummary = {
  totalLeaveDays: bigint;
  peopleCount: bigint;
  currentPeople: bigint;
  formerPeople: bigint;
};

function validDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function pageHref(page: number, q: string, from: string, to: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return query ? `/guild/members/leave/history?${query}` : "/guild/members/leave/history";
}

export default async function LeaveHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requirePageAuth();
  if (!hasPermission(auth.role, "leave.manageAny")) redirect("/");

  const params = await searchParams;
  const requestedPage = Number(params.page ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1_000_000) : 1;
  const q = (params.q ?? "").trim().slice(0, 100);
  const from = validDate(params.from);
  const to = validDate(params.to);
  const fromLabel = from ? params.from! : "";
  const toLabel = to ? params.to! : "";
  const fetchPeople = () => prisma.$queryRaw<LeavePerson[]>`
    WITH leave_rows AS (
      SELECT
        CASE WHEN gm."discordUserId" IS NOT NULL THEN 'discord:' || gm."discordUserId"
             ELSE 'member:' || gm."id" END AS "identityKey",
        ml."id" AS "id",
        COALESCE(gm."characterName", 'Unknown') AS "characterName",
        gm."discordUsername" AS "discordUsername",
        gm."job" AS "job",
        ml."date" AS "date",
        ml."reason" AS "reason",
        TRUE AS "current"
      FROM "MemberLeave" ml
      INNER JOIN "GuildMember" gm ON gm."id" = ml."memberId"
      WHERE gm."guildId" = ${auth.guild.id}
      UNION ALL
      SELECT
        CASE WHEN lh."discordUserId" IS NOT NULL THEN 'discord:' || lh."discordUserId"
             WHEN lh."originalMemberId" IS NOT NULL THEN 'member:' || lh."originalMemberId"
             ELSE 'archive:' || lh."id" END AS "identityKey",
        'archived-' || lh."id" AS "id",
        COALESCE(lh."characterName", 'Unknown') AS "characterName",
        lh."discordUsername" AS "discordUsername",
        lh."job" AS "job",
        lh."date" AS "date",
        lh."reason" AS "reason",
        FALSE AS "current"
      FROM "LeaveHistory" lh
      WHERE lh."guildId" = ${auth.guild.id}
    ),
    filtered AS (
      SELECT * FROM leave_rows
      WHERE (${q} = '' OR "characterName" ILIKE '%' || ${q} || '%' OR COALESCE("discordUsername", '') ILIKE '%' || ${q} || '%')
        AND (${from}::timestamp IS NULL OR "date" >= ${from})
        AND (${to}::timestamp IS NULL OR "date" < ${to ? new Date(to.getTime() + 86400000) : null})
    )
    SELECT
      "identityKey" AS "key",
      (ARRAY_AGG("characterName" ORDER BY "date" DESC))[1] AS "characterName",
      (ARRAY_AGG("discordUsername" ORDER BY "date" DESC) FILTER (WHERE "discordUsername" IS NOT NULL))[1] AS "discordUsername",
      (ARRAY_AGG("job" ORDER BY "date" DESC) FILTER (WHERE "job" IS NOT NULL))[1] AS "job",
      BOOL_OR("current") AS "current",
      COUNT(*) AS "count",
      MAX("date") AS "latest"
    FROM filtered
    GROUP BY "identityKey"
    ORDER BY COUNT(*) DESC, MAX("date") DESC, "identityKey" ASC
    LIMIT ${PAGE_SIZE} OFFSET ${safeOffset}
  `;

  const summaryQuery = prisma.$queryRaw<LeaveSummary[]>`
    WITH leave_rows AS (
      SELECT
        CASE WHEN gm."discordUserId" IS NOT NULL THEN 'discord:' || gm."discordUserId"
             ELSE 'member:' || gm."id" END AS "identityKey",
        COALESCE(gm."characterName", 'Unknown') AS "characterName",
        gm."discordUsername" AS "discordUsername",
        ml."date" AS "date",
        TRUE AS "current"
      FROM "MemberLeave" ml
      INNER JOIN "GuildMember" gm ON gm."id" = ml."memberId"
      WHERE gm."guildId" = ${auth.guild.id}
      UNION ALL
      SELECT
        CASE WHEN lh."discordUserId" IS NOT NULL THEN 'discord:' || lh."discordUserId"
             WHEN lh."originalMemberId" IS NOT NULL THEN 'member:' || lh."originalMemberId"
             ELSE 'archive:' || lh."id" END AS "identityKey",
        COALESCE(lh."characterName", 'Unknown') AS "characterName",
        lh."discordUsername" AS "discordUsername",
        lh."date" AS "date",
        FALSE AS "current"
      FROM "LeaveHistory" lh
      WHERE lh."guildId" = ${auth.guild.id}
    ),
    filtered AS (
      SELECT * FROM leave_rows
      WHERE (${q} = '' OR "characterName" ILIKE '%' || ${q} || '%' OR COALESCE("discordUsername", '') ILIKE '%' || ${q} || '%')
        AND (${from}::timestamp IS NULL OR "date" >= ${from})
        AND (${to}::timestamp IS NULL OR "date" < ${to ? new Date(to.getTime() + 86400000) : null})
    ),
    people AS (
      SELECT "identityKey", BOOL_OR("current") AS "current"
      FROM filtered GROUP BY "identityKey"
    )
    SELECT
      COUNT(*) AS "totalLeaveDays",
      COUNT(DISTINCT "identityKey") AS "peopleCount",
      (SELECT COUNT(*) FROM people WHERE "current") AS "currentPeople",
      (SELECT COUNT(*) FROM people WHERE NOT "current") AS "formerPeople"
    FROM filtered
  `;

  const summaryRows = await summaryQuery;
  const summary = summaryRows[0] ?? { totalLeaveDays: BigInt(0), peopleCount: BigInt(0), currentPeople: BigInt(0), formerPeople: BigInt(0) };
  const totalPeople = Number(summary.peopleCount);
  const totalPages = Math.max(1, Math.ceil(totalPeople / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const safeOffset = (currentPage - 1) * PAGE_SIZE;
  const people = await fetchPeople();

  // Fetch only the six most recent dates for the 25 people on this page.
  const pageKeys = people.map((person) => person.key);
  const dates: LeaveDate[] = pageKeys.length
    ? await prisma.$queryRaw<LeaveDate[]>`
        WITH leave_rows AS (
          SELECT
            CASE WHEN gm."discordUserId" IS NOT NULL THEN 'discord:' || gm."discordUserId"
                 ELSE 'member:' || gm."id" END AS "identityKey",
            ml."id" AS "id", ml."date" AS "date", ml."reason" AS "reason"
          FROM "MemberLeave" ml
          INNER JOIN "GuildMember" gm ON gm."id" = ml."memberId"
          WHERE gm."guildId" = ${auth.guild.id}
          UNION ALL
          SELECT
            CASE WHEN lh."discordUserId" IS NOT NULL THEN 'discord:' || lh."discordUserId"
                 WHEN lh."originalMemberId" IS NOT NULL THEN 'member:' || lh."originalMemberId"
             ELSE 'archive:' || lh."id" END AS "identityKey",
            'archived-' || lh."id" AS "id", lh."date" AS "date", lh."reason" AS "reason"
          FROM "LeaveHistory" lh
          WHERE lh."guildId" = ${auth.guild.id}
        ),
        ranked AS (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY "identityKey" ORDER BY "date" DESC, "id" DESC) AS "position"
          FROM leave_rows
          WHERE "identityKey" = ANY(${pageKeys}::text[])
        )
        SELECT "identityKey" AS "key", "id", "date", "reason"
        FROM ranked WHERE "position" <= 6
        ORDER BY "identityKey", "date" DESC, "id" DESC
      `
    : [];

  const datesByPerson = new Map<string, LeaveDate[]>();
  for (const leave of dates) {
    const list = datesByPerson.get(leave.key) ?? [];
    list.push(leave);
    datesByPerson.set(leave.key, list);
  }

  const formatDate = (date: Date) => date.toLocaleDateString("en-MY", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur",
  });

  return (
    <main className="hmdl-management hmdl-leave-history-workspace min-h-screen bg-zinc-950 text-white">
      <div className="hmdl-page">
        <ManagementPageHeader
          eyebrow="PEOPLE"
          title="Leave History"
          description="Review leave frequency across current and former guild members."
        />

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-sm text-zinc-500">Total Leave Days</p><p className="mt-2 text-3xl font-bold">{Number(summary.totalLeaveDays).toLocaleString()}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-sm text-zinc-500">People With Leave</p><p className="mt-2 text-3xl font-bold">{totalPeople.toLocaleString()}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-sm text-zinc-500">Current Members</p><p className="mt-2 text-3xl font-bold">{Number(summary.currentPeople).toLocaleString()}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-sm text-zinc-500">Former Members</p><p className="mt-2 text-3xl font-bold">{Number(summary.formerPeople).toLocaleString()}</p></div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <form method="GET" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_auto_auto_auto]">
            <label className="text-sm text-zinc-400">
              Search member
              <input name="q" defaultValue={q} placeholder="Character or Discord username" className="mt-1 min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white placeholder:text-zinc-600" />
            </label>
            <label className="text-sm text-zinc-400">
              From
              <input type="date" name="from" defaultValue={fromLabel} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white" />
            </label>
            <label className="text-sm text-zinc-400">
              To
              <input type="date" name="to" defaultValue={toLabel} min={fromLabel || undefined} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-white" />
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500">Apply</button>
              <a href="/guild/members/leave/history" className="inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 text-sm text-zinc-300 hover:bg-zinc-800">Reset</a>
            </div>
          </form>

          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Leave Frequency</h2>
              <p className="mt-1 text-sm text-zinc-500">Sorted by number of leave dates, highest first.</p>
            </div>
            <p className="text-sm text-zinc-500">Showing {totalPeople === 0 ? 0 : safeOffset + 1}–{Math.min(safeOffset + PAGE_SIZE, totalPeople)} of {totalPeople.toLocaleString()} people</p>
          </div>

          {people.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-600">No leave history matches these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th scope="col" className="px-3 py-3 font-medium">Member</th>
                    <th scope="col" className="px-3 py-3 font-medium">Job</th>
                    <th scope="col" className="px-3 py-3 font-medium">Leave Days</th>
                    <th scope="col" className="px-3 py-3 font-medium">Latest Leave</th>
                    <th scope="col" className="px-3 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.key} className="border-b border-zinc-800/70 align-top last:border-0">
                      <td className="px-3 py-4">
                        <div className="font-semibold text-white">{person.characterName}</div>
                        {person.discordUsername && <div className="mt-1 text-xs text-zinc-500">{person.discordUsername}</div>}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(datesByPerson.get(person.key) ?? []).map((leave) => (
                            <span key={leave.id} title={leave.reason ?? undefined} className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-400">{formatDate(leave.date)}</span>
                          ))}
                          {Number(person.count) > 6 && <span className="px-1 py-1 text-xs text-zinc-600">+{Number(person.count) - 6} more</span>}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-zinc-400">{person.job ?? "—"}</td>
                      <td className="px-3 py-4"><span className="inline-flex min-w-8 justify-center rounded-full bg-zinc-800 px-2.5 py-1 font-semibold text-white">{Number(person.count)}</span></td>
                      <td className="px-3 py-4 text-zinc-400">{formatDate(person.latest)}</td>
                      <td className="px-3 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${person.current ? "bg-emerald-950 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>
                          {person.current ? "Current" : "Former"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <nav aria-label="Leave history pages" className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-5">
              <a
                href={pageHref(Math.max(1, currentPage - 1), q, fromLabel, toLabel)}
                aria-disabled={currentPage <= 1}
                className={`inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 text-sm ${currentPage <= 1 ? "pointer-events-none opacity-40" : "text-zinc-200 hover:bg-zinc-800"}`}
              >Previous</a>
              <span className="text-sm text-zinc-500" aria-live="polite">Page {currentPage} of {totalPages}</span>
              <a
                href={pageHref(Math.min(totalPages, currentPage + 1), q, fromLabel, toLabel)}
                aria-disabled={currentPage >= totalPages}
                className={`inline-flex min-h-11 items-center rounded-lg border border-zinc-700 px-4 text-sm ${currentPage >= totalPages ? "pointer-events-none opacity-40" : "text-zinc-200 hover:bg-zinc-800"}`}
              >Next</a>
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
