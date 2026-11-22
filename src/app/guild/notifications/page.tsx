import Link from "next/link";
import { requirePageAuth, hasPermission } from "@/lib/auth";
import NotificationsForm from "./NotificationsForm";

export default async function GuildNotificationsPage() {
  const auth = await requirePageAuth();

  if (!hasPermission(auth.role, "guild.manage")) {
    return (
      <main className="hmdl-management hmdl-guild-config-workspace min-h-screen bg-zinc-950 text-white">
        <div className="hmdl-page mx-auto max-w-4xl px-6 py-10">
          <div className="mt-8 rounded-2xl border border-red-900 bg-zinc-900 p-8">
            <h1 className="text-xl font-semibold">Access Denied</h1>
            <p className="mt-2 text-sm text-zinc-400">You do not have permission to manage guild settings.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="hmdl-management hmdl-guild-config-workspace min-h-screen bg-zinc-950 text-white">
      <div className="hmdl-page mx-auto max-w-4xl px-6 py-10">
        <header className="mt-6 mb-8">
          <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">HMDL</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Discord Notifications</h1>
          <p className="mt-2 text-zinc-400">Push roster changes, completed bid pages and stat reminders into dedicated Discord channels.</p>
        </header>
        <NotificationsForm />
      </div>
    </main>
  );
}
