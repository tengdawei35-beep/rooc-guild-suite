import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth";
import { hasCombatSimulatorAccess } from "@/lib/ro3-combat-simulator/entitlements";
import CombatSimulatorProfiles from "./CombatSimulatorProfiles";

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

  return <section className="flex min-h-[calc(100vh-5rem)] flex-col gap-4 text-white">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">RO3 tools</p><h1 className="mt-2 text-2xl font-semibold">Combat Simulator</h1><p className="mt-1 text-sm text-zinc-400">Community R&D damage estimates. Results may differ from live game outcomes.</p></div>
      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">Preliminary integration</span>
    </header>
    <CombatSimulatorProfiles />
    <p className="text-xs leading-5 text-zinc-500">Simulator source is served behind Heimdall authentication and entitlement checks. Some PvP effects, healing, shields and selected skill interactions are not fully modeled. This is an estimate, not an official game calculator.</p>
  </section>;
}
