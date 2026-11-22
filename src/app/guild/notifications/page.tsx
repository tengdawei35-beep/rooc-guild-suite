import { requirePageAuth, hasPermission } from "@/lib/auth";
import NotificationsForm from "./NotificationsForm";
import ManagementPageHeader from "@/app/ManagementPageHeader";

export default async function GuildNotificationsPage() {
  const auth = await requirePageAuth();

  if (!hasPermission(auth.role, "guild.manage")) {
    return (
      <main className="hmdl-management hmdl-guild-config-workspace min-h-screen bg-zinc-950 text-white">
        <div className="hmdl-page mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-2xl border border-red-900 bg-zinc-900 p-8">
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
        <ManagementPageHeader
          eyebrow="CONFIGURATION"
          title="Discord Notifications"
          description="Push roster changes, completed bid pages and stat reminders into dedicated Discord channels."
        />
        <NotificationsForm />
      </div>
    </main>
  );
}
