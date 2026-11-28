import { requirePageAuth } from "@/lib/auth";
import ManagementPageHeader from "@/app/ManagementPageHeader";
import { hasGuildModule, RESOURCE_SUITE_MODULE, isRoocGuild } from "@/lib/auth/modules";
import Ro3OptInsClient from "./Ro3OptInsClient";

export default async function Ro3OptInsPage() {
  const auth = await requirePageAuth();
  if (!(await hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE))) {
    return <main className="hmdl-management hmdl-member-optins-workspace min-h-screen bg-zinc-950 text-white"><div className="hmdl-page"><ManagementPageHeader eyebrow="RESOURCES" title="Resource Opt-ins" description="Member resource opt-ins are part of the Resource Suite." /><div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 p-8"><h2 className="font-semibold">Resource Suite required</h2><p className="mt-2 text-sm text-zinc-400">Your guild plan does not include resource opt-ins.</p></div></div></main>;
  }
  const isRooc = await isRoocGuild(auth.guild.id);
  if (isRooc) {
    return <main className="hmdl-management hmdl-member-optins-workspace min-h-screen bg-zinc-950 text-white"><div className="hmdl-page"><ManagementPageHeader eyebrow="RESOURCES" title="Resource Opt-ins" description="Member resource opt-ins are only available to RO3 guilds." /><div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">This feature is unavailable for ROOC guilds.</div></div></main>;
  }
  return <main className="hmdl-management hmdl-member-optins-workspace min-h-screen bg-zinc-950 text-white"><div className="hmdl-page"><ManagementPageHeader eyebrow="RESOURCES" title="My Resource Opt-ins" description="Choose the Cards, Equipment and Echoes you want to be considered for." /><Ro3OptInsClient /></div></main>;
}
