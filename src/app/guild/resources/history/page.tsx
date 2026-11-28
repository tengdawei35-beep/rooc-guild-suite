import { redirect } from "next/navigation";
import { hasPermission, requirePageAuth } from "@/lib/auth";
import { hasGuildModule, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";
import ResourceHistoryClient from "./ResourceHistoryClient";

export default async function ResourceHistoryPage() {
  const auth = await requirePageAuth();
  if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) {
    return <main className="hmdl-management hmdl-history-workspace min-h-screen bg-zinc-950 text-white"><div className="hmdl-page mx-auto max-w-7xl px-6 py-10"><div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center"><h1 className="text-xl font-semibold">Resource Suite required</h1><p className="mt-2 text-sm text-zinc-400">Allocation history is part of the Resource Suite and is not enabled for this guild.</p></div></div></main>;
  }
  if (!hasPermission(auth.role, "allocation.view")) redirect("/");
  return <main className="hmdl-management hmdl-history-workspace"><div className="hmdl-page"><ResourceHistoryClient /></div></main>;
}
