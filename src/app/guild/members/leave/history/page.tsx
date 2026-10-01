import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ArchivedLeave = {
  id: string;
  discordUserId: string | null;
  discordUsername: string | null;
  characterName: string | null;
  job: string | null;
  date: Date;
  reason: string | null;
};

type LeaveRow = {
  id: string;
  key: string;
  characterName: string;
  discordUsername: string | null;
  job: string | null;
  date: Date;
  reason: string | null;
  current: boolean;
};

export default async function LeaveHistoryPage() {
  const auth = await requirePageAuth();
  if (!hasPermission(auth.role, "leave.manageAny")) redirect("/");

  const [currentLeaves, archivedLeaves] = await Promise.all([
    prisma.memberLeave.findMany({
      where: { member: { guildId: auth.guild.id } },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        reason: true,
        member: {
          select: {
            id: true,
            discordUserId: true,
            discordUsername: true,
            characterName: true,
            job: true,
          },
        },
      },
    }),
    prisma.$queryRaw<ArchivedLeave[]>`
      SELECT "id", "discordUserId", "discordUsername", "characterName", "job", "date", "reason"
      FROM "LeaveHistory"
      WHERE "guildId" = ${auth.guild.id}
      ORDER BY "date" DESC
    `,
  ]);

  const rows: LeaveRow[] = [
    ...currentLeaves.map((leave) => ({
      id: leave.id,
      key: leave.member.discordUserId ?? leave.member.id,
      characterName: leave.member.characterName ?? "Unknown",
      discordUsername: leave.member.discordUsername,
      job: leave.member.job,
      date: leave.date,
      reason: leave.reason,
      current: true,
    })),
    ...archivedLeaves.map((leave) => ({
      id: `archived-${leave.id}`,
      key: leave.discordUserId ?? `archived:${leave.characterName ?? "unknown"}`,
      characterName: leave.characterName ?? "Unknown",
      discordUsername: leave.discordUsername,
      job: leave.job,
      date: leave.date,
      reason: leave.reason,
      current: false,
    })),
  ];

  const grouped = new Map<string, {
    key: string;
    characterName: string;
    discordUsername: string | null;
    job: string | null;
    current: boolean;
    count: number;
    latest: Date;
    dates: LeaveRow[];
  }>();

  for (const row of rows) {
    const existing = grouped.get(row.key);
    if (existing) {
      existing.count += 1;
      existing.current ||= row.current;
      if (row.date > existing.latest) existing.latest = row.date;
      existing.dates.push(row);
    } else {
      grouped.set(row.key, {
        key: row.key,
        characterName: row.characterName,
        discordUsername: row.discordUsername,
        job: row.job,
        current: row.current,
        count: 1,
        latest: row.date,
        dates: [row],
      });
    }
  }

  const people = Array.from(grouped.values()).sort((a, b) => b.count - a.count || b.latest.getTime() - a.latest.getTime());
  const currentPeople = people.filter((person) => person.current).length;
  const archivedPeople = people.filter((person) => !person.current).length;
  const totalLeaveDays = rows.length;

  const formatDate = (date: Date) => date.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link href="/guild/members" className="text-sm text-zinc-500 hover:text-white">← Guild Members</Link>

        <header className="mt-6 mb-8">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">{auth.guild.name}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Leave History</h1>
          <p className="mt-2 text-zinc-400">Review leave frequency across current and former guild members.</p>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-sm text-zinc-500">Total Leave Days</p><p className="mt-2 text-3xl font-bold">{totalLeaveDays}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-sm text-zinc-500">People With Leave</p><p className="mt-2 text-3xl font-bold">{people.length}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-sm text-zinc-500">Current Members</p><p className="mt-2 text-3xl font-bold">{currentPeople}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-sm text-zinc-500">Former Members</p><p className="mt-2 text-3xl font-bold">{archivedPeople}</p></div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Leave Frequency</h2>
            <p className="mt-1 text-sm text-zinc-500">Sorted by number of leave dates, highest first.</p>
          </div>

          {people.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-600">No leave history has been recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="px-3 py-3 font-medium">Member</th>
                    <th className="px-3 py-3 font-medium">Job</th>
                    <th className="px-3 py-3 font-medium">Leave Days</th>
                    <th className="px-3 py-3 font-medium">Latest Leave</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.key} className="border-b border-zinc-800/70 align-top last:border-0">
                      <td className="px-3 py-4">
                        <div className="font-semibold text-white">{person.characterName}</div>
                        {person.discordUsername && <div className="mt-1 text-xs text-zinc-500">{person.discordUsername}</div>}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {person.dates.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6).map((leave) => (
                            <span key={leave.id} title={leave.reason ?? undefined} className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-400">{formatDate(leave.date)}</span>
                          ))}
                          {person.dates.length > 6 && <span className="px-1 py-1 text-xs text-zinc-600">+{person.dates.length - 6} more</span>}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-zinc-400">{person.job ?? "—"}</td>
                      <td className="px-3 py-4"><span className="inline-flex min-w-8 justify-center rounded-full bg-zinc-800 px-2.5 py-1 font-semibold text-white">{person.count}</span></td>
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
        </section>
      </div>
    </main>
  );
}
