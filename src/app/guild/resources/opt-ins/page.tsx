import { requirePageAuth } from "@/lib/auth";
import ManagementPageHeader from "@/app/ManagementPageHeader";
import { isRoocGuild } from "@/lib/auth/modules";
import Ro3OptInsClient from "./Ro3OptInsClient";

export default async function Ro3OptInsPage() {
  const auth = await requirePageAuth();
  const isRooc = await isRoocGuild(auth.guild.id);
  if (isRooc) {
    return <main className="hmdl-management hmdl-member-optins-workspace min-h-screen bg-zinc-950 text-white"><div className="hmdl-page"><ManagementPageHeader eyebrow="RESOURCES" title="Resource Opt-ins" description="Member resource opt-ins are only available to RO3 guilds." /><div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">This feature is unavailable for ROOC guilds.</div></div></main>;
  }
  return <main className="hmdl-management hmdl-member-optins-workspace min-h-screen bg-zinc-950 text-white"><div className="hmdl-page"><ManagementPageHeader eyebrow="RESOURCES" title="My Resource Opt-ins" description="Choose the Cards, Equipment and Echoes you want to be considered for." /><Ro3OptInsClient /></div></main>;
}
