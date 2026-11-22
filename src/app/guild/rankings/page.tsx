import RankingsClient from "./RankingsClient";
import Link from "next/link";
import { requirePageAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function RankingsPage() {
  const auth = await requirePageAuth();
  if (!hasPermission(auth.role, "members.view")) redirect("/");
  const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } });
  if (guild?.gameType === "RO3") {
    return <main className="hmdl-management hmdl-insights-workspace min-h-screen bg-zinc-950 text-white"><div className="hmdl-page mx-auto max-w-7xl px-6 py-10"><div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8"><h1 className="text-xl font-semibold">RO3 Rankings</h1><p className="mt-2 text-sm text-zinc-400">RO3 ranking calculations are not available yet. ROOC scoring is intentionally disabled for RO3 guilds.</p><Link href="/guild/members" className="hmdl-btn hmdl-btn-primary mt-5 inline-flex px-4 py-2 text-sm font-medium">View Guild Members</Link></div></div></main>;
  }
  return <main className="hmdl-management hmdl-insights-workspace min-h-screen bg-zinc-950 text-white"><div className="hmdl-page mx-auto max-w-7xl px-6 pt-8"></div><RankingsClient /></main>;
}
