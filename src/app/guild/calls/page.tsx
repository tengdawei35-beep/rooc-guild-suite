import { redirect } from "next/navigation";
import { requirePageAuth, hasPermission } from "@/lib/auth";
import CallsClient from "./CallsClient";
import { prisma } from "@/lib/prisma";

export default async function CallsPage() {
  const auth = await requirePageAuth();
  if (!hasPermission(auth.role, "events.view")) redirect("/");
  const guild = await prisma.guild.findUnique({ where: { id: auth.guild.id }, select: { gameType: true } });
  return <main className="hmdl-management hmdl-calls-workspace"><div className="hmdl-page"><CallsClient gameType={guild?.gameType === "RO3" ? "RO3" : "ROOC"} canManageDiscord={["ADMIN", "MANAGER", "OFFICER"].includes(auth.role)} /></div></main>;
}
