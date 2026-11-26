import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth";
import { hasCombatSimulatorAccess } from "@/lib/ro3-combat-simulator/entitlements";
import NativeCombatSimulatorPreview from "./NativeCombatSimulatorPreview";

export const metadata = { title: "RO3 Combat Simulator" };

export default async function CombatSimulatorPage() {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/login?error=authentication_required");
  const allowed = await hasCombatSimulatorAccess(auth.user.id, auth.guild.id);
  if (!allowed) redirect("/billing/new?feature=combat-simulator");

  if (auth.guild.gameType !== "RO3") {
    return <section className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-zinc-900 p-8 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">RO3 tools</p>
      <h1 className="mt-3 text-2xl font-semibold">Combat Simulator</h1>
      <p className="mt-3 text-sm text-zinc-400">The combat simulator is available in RO3 guild workspaces. Your personal subscription remains active and can be used when you switch to an RO3 guild.</p>
    </section>;
  }

  return <div className="hmdl-management hmdl-combat-simulator-workspace">
    <section className="hmdl-page flex min-h-[calc(100vh-5rem)] flex-col gap-5 text-white">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="hmdl-page-eyebrow">RO3 TOOLS</p><h1 className="hmdl-page-title">Combat Simulator</h1><p className="hmdl-page-description">Model damage output, compare builds and test character profiles. Results may differ from live game outcomes.</p></div>
        <span className="rounded-full border border-[var(--hmdl-warning)]/30 bg-[var(--hmdl-warning)]/10 px-3 py-1.5 text-xs font-medium text-[var(--hmdl-warning)]">Community tool · Preliminary</span>
      </header>
      <NativeCombatSimulatorPreview />
      <p className="text-xs leading-5 text-zinc-500">Some PvP effects, healing, shields and selected skill interactions are not fully modeled. Results are estimates, not an official game calculator.</p>
    </section>
  </div>;
}
