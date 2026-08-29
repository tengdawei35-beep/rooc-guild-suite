import MemberProfileClient from "./MemberProfileClient";
import { hasPermission, requirePageAuth } from "@/lib/auth";
import { calculateRawPdef, calculateRawMdef } from "@/lib/scoring/roo-scoring";
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
    select: { pdef: true, mdef: true, equipmentPdefPercent: true, equipmentMdefPercent: true },
  });

  if (!member) {
    redirect("/guild/members");
  }

  const rawPdef = calculateRawPdef(member.pdef, member.equipmentPdefPercent);
  const rawMdef = calculateRawMdef(member.mdef, member.equipmentMdefPercent);

  return (
    <>
      <MemberProfileClient memberId={memberId} rawPdef={rawPdef} rawMdef={rawMdef} />
    </>
  );
}
