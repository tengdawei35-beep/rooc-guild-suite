import { redirect } from "next/navigation";
import GuildStatisticsClient from "./GuildStatisticsClient";
import { hasPermission, requirePageAuth } from "@/lib/auth";

export default async function GuildStatisticsPage() {
  const auth = await requirePageAuth();
  if (!hasPermission(auth.role, "members.view")) redirect("/");
  return <main className="hmdl-management hmdl-insights-workspace"><div className="hmdl-page"><GuildStatisticsClient /></div></main>;
}
