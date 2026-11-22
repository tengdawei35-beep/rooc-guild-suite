import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MembersClient from "./MembersClient";
import { requirePageAuth, hasPermission } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function MembersPage() {
  const auth = await requirePageAuth();
  if (!hasPermission(auth.role, "members.view")) redirect("/");

  const guild = await prisma.guild.findUnique({
    where: { id: auth.guild.id },
    select: { gameType: true },
  });

  if (!guild) {
    return (
      <main className="hmdl-management hmdl-member-directory-workspace min-h-screen text-white">
        <div className="hmdl-page">
          <div className="hmdl-empty">
            <h1 className="text-xl font-semibold text-zinc-200">No guild configured</h1>
            <p className="mt-2 text-sm">Configure your guild before managing members.</p>
            <Link href="/guild" className="hmdl-btn hmdl-btn-primary mt-5">Configure Guild</Link>
          </div>
        </div>
      </main>
    );
  }

  return <MembersClient initialMembers={[]} gameType={guild.gameType} />;
}
