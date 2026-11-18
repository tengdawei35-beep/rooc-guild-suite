import MemberProfileClient from "./MemberProfileClient";
import { hasPermission, requirePageAuth } from "@/lib/auth";
import { calculateRawPdef, calculateRawMdef } from "@/lib/scoring/roo-scoring";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

type PageProps = { params: Promise<{ memberId: string }> };

export default async function MemberProfilePage({ params }: PageProps) {
  const auth = await requirePageAuth();

  if (!hasPermission(auth.role, "members.view")) {
    redirect("/guild/members");
  }

  const { memberId } = await params;
  const member = await prisma.guildMember.findFirst({
    where: { id: memberId, guildId: auth.guild.id },
    select: {
      id: true,
      characterName: true,
      job: true,
      discordUsername: true,
      active: true,
      eligible: true,
      priority: true,
      remarks: true,
      userId: true,
      discordUserId: true,
      pdef: true,
      mdef: true,
      equipmentPdefPercent: true,
      equipmentMdefPercent: true,
    },
  });

  if (!member) {
    redirect("/guild/members");
  }

  const canViewCharacterStats =
    auth.role !== "MEMBER" ||
    member.userId === auth.user.id ||
    member.discordUserId === auth.user.discordId;

  if (!canViewCharacterStats) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-4xl p-6">
          <Link href="/guild/members" className="text-sm text-zinc-500 transition hover:text-white">← Guild Members</Link>
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{member.characterName}</h1>
                <div className="mt-2 text-sm text-zinc-500">{member.characterName}{member.job ? ` • ${member.job}` : ""}</div>
              </div>
              <div className="flex gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${member.active ? "border-emerald-800 bg-emerald-950/50 text-emerald-300" : "border-zinc-700 bg-zinc-900 text-zinc-500"}`}>{member.active ? "Active" : "Inactive"}</span>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${member.eligible ? "border-emerald-800 bg-emerald-950/50 text-emerald-300" : "border-zinc-700 bg-zinc-900 text-zinc-500"}`}>{member.eligible ? "Eligible" : "Ineligible"}</span>
              </div>
            </div>

            <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 md:grid-cols-2">
              <div className="bg-zinc-950 p-4"><div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Character</div><div className="mt-1 text-sm text-zinc-300">{member.characterName || "—"}</div></div>
              <div className="bg-zinc-950 p-4"><div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Discord Name</div><div className="mt-1 text-sm text-zinc-300">{member.discordUsername || "—"}</div></div>
              <div className="bg-zinc-950 p-4"><div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Job</div><div className="mt-1 text-sm text-zinc-300">{member.job || "—"}</div></div>
              <div className="bg-zinc-950 p-4"><div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Priority</div><div className="mt-1 text-sm text-zinc-300">{member.priority}</div></div>
            </div>

            <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
              Character stats and performance information are only visible to the member themselves and authorized guild staff.
            </div>
          </div>
        </div>
      </main>
    );
  }

  const rawPdef = calculateRawPdef(member.pdef, member.equipmentPdefPercent);
  const rawMdef = calculateRawMdef(member.mdef, member.equipmentMdefPercent);

  return <MemberProfileClient memberId={memberId} rawPdef={rawPdef} rawMdef={rawMdef} />;
}
