import MemberProfileClient from "./MemberProfileClient";
import { hasPermission, requirePageAuth } from "@/lib/auth";
import { calculateRawPdef } from "@/lib/scoring/roo-scoring";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ memberId: string }> };

export default async function MemberProfilePage({ params }: PageProps) {
  const auth = await requirePageAuth();

  if (!hasPermission(auth.role, "members.view")) {
    redirect("/guild/members");
  }

  const { memberId } = await params;
  const member = await prisma.guildMember.findFirst({
    where: { id: memberId, guildId: auth.guild.id },
    select: { pdef: true, equipmentPdefPercent: true },
  });

  if (!member) {
    redirect("/guild/members");
  }

  const rawPdef = calculateRawPdef(member.pdef, member.equipmentPdefPercent);

  return (
    <>
      <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-4 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Derived Character Stat</p>
            <p className="mt-1 text-sm text-zinc-400">RAW PDEF = Equipment PDEF ÷ (1 + Equipment PDEF %)</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-zinc-500">RAW PDEF</p>
            <p className="mt-1 text-xl font-bold">{rawPdef.toFixed(2)}</p>
          </div>
        </div>
      </div>
      <MemberProfileClient memberId={memberId} />
    </>
  );
}
