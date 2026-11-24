import { redirect } from "next/navigation";
import ManagementPageHeader from "@/app/ManagementPageHeader";
import { getPlatformAdmin } from "@/lib/platform-admin";
import CombatSimulatorAccessClient from "./CombatSimulatorAccessClient";

export const dynamic = "force-dynamic";

export default async function CombatSimulatorAccessPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/login");
  return <main className="hmdl-platform-admin-workspace min-h-screen bg-zinc-950 text-white"><div className="hmdl-page">
    <ManagementPageHeader eyebrow="PLATFORM · PRODUCT ACCESS" title="Combat Simulator Access" description="Manage complimentary Combat Simulator access for individual accounts and guild communities." />
    <div className="mt-6"><CombatSimulatorAccessClient /></div>
  </div></main>;
}
