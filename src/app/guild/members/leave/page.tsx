import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LeaveApplicationClient from "./LeaveApplicationClient";

export default async function ApplyLeavePage() {
  const auth = await requirePageAuth();

  if (!hasPermission(auth.role, "leave.manageOwn")) {
    redirect("/");
  }

  const member = await prisma.guildMember.findFirst({
    where: {
      guildId: auth.guild.id,
      userId: auth.user.id,
    },
    select: {
      id: true,
      characterName: true,
      leaveDates: {
        orderBy: { date: "asc" },
        where: { date: { gte: new Date() } },
        select: { id: true, date: true, reason: true },
      },
    },
  });

  if (!member) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-xl px-6 py-10">
          <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Dashboard</Link>
          <section className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center">
            <h1 className="text-xl font-semibold">Member profile not found</h1>
            <p className="mt-2 text-sm text-zinc-400">Your Discord account is not currently linked to a guild member profile.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-xl px-6 py-10">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white">← Dashboard</Link>
        <div className="mt-6">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Your Character</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Apply Leave</h1>
          <p className="mt-2 text-sm text-zinc-400">{member.characterName ?? "Member"} · Mark yourself unavailable for a date.</p>
        </div>
        <LeaveApplicationClient
          memberId={member.id}
          initialLeaves={member.leaveDates.map((leave) => ({
            id: leave.id,
            date: leave.date.toISOString(),
            reason: leave.reason,
          }))}
        />
      </div>
    </main>
  );
}
