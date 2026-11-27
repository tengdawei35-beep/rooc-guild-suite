import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth";
import { hasCombatSimulatorAccess } from "@/lib/ro3-combat-simulator/entitlements";
import NativeCombatSimulatorPreview from "../NativeCombatSimulatorPreview";

export const metadata = { title: "RO3 Combat Simulator · Native Preview" };

/** Isolated migration preview. The production combat-simulator route remains on the legacy iframe. */
export default async function NativeCombatSimulatorPreviewPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/login?error=authentication_required");
  const allowed = await hasCombatSimulatorAccess(auth.user.id, auth.guild.id);
  if (!allowed) redirect("/billing/new?feature=combat-simulator");
  if (auth.guild.gameType !== "RO3") redirect("/combat-simulator");

  return <div className="hmdl-management">
    <section className="hmdl-page mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl flex-col gap-5 text-white">
      <header>
        <p className="hmdl-page-eyebrow">RO3 TOOLS · MIGRATION PREVIEW</p>
        <h1 className="hmdl-page-title">Combat Simulator — Native Preview</h1>
        <p className="hmdl-page-description">The native React combat simulator workspace. The main simulator route uses this same workspace.</p>
      </header>
      <NativeCombatSimulatorPreview />
    </section>
  </div>;
}
