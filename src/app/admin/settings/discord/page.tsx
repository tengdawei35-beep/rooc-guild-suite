import { redirect } from "next/navigation";
import ManagementPageHeader from "@/app/ManagementPageHeader";
import { getPlatformAdmin } from "@/lib/platform-admin";
import DiscordRoleMappingsClient from "./DiscordRoleMappingsClient";

export default async function DiscordSettingsPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/login");
  return (
    <main className="hmdl-platform-admin-workspace min-h-screen bg-zinc-950 text-white">
      <div className="hmdl-page">
        <ManagementPageHeader eyebrow="PLATFORM · INTEGRATIONS" title="Discord role sync" description="Map HMDL subscription plans to existing roles in the official HMDL Discord server." />
        <DiscordRoleMappingsClient />
      </div>
    </main>
  );
}
