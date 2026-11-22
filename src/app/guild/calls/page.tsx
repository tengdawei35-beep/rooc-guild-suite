import Link from "next/link";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import CallsClient from "./CallsClient";
import { prisma } from "@/lib/prisma";

export default async function CallsPage() {
  const auth = await getCurrentAuth();
  if (!auth) return null;
  if (!hasPermission(auth.role, "events.view")) return <main className="min-h-screen bg-zinc-950 p-8 text-white">You do not have permission to view Call To Arms.</main>;
  const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } });
  return <main className="hmdl-management hmdl-calls-workspace"><div className="hmdl-page"><CallsClient gameType={guild?.gameType === "RO3" ? "RO3" : "ROOC"} canManageDiscord={["ADMIN", "MANAGER", "OFFICER"].includes(auth.role)} /></div></main>;
}
