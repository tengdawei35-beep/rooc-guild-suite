import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCurrentAuth, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNotificationConfig } from "@/lib/discord-notifications";

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "guild.manage")) return NextResponse.json({ error: "You do not have permission to view guild onboarding." }, { status: 403 });

  const guildId = auth.guild.id;
  const [members, managers, events, resources, activeInvites, config, callRows, progress] = await Promise.all([
    prisma.guildMember.count({ where: { guildId, active: true } }),
    prisma.guildMembership.count({ where: { guildId } }),
    prisma.event.count({ where: { guildId } }),
    prisma.resource.count({ where: { guildId, active: true } }),
    prisma.applicantInvite.count({ where: { guildId, active: true } }),
    getNotificationConfig(guildId),
    prisma.$queryRaw<Array<{ webhook_url: string | null }>>`SELECT "webhook_url" FROM "guild_call_webhooks" WHERE "guild_id" = ${guildId} LIMIT 1`.catch(() => []),
    prisma.guildOnboardingProgress.findUnique({ where: { guildId }, select: { dismissedAt: true } }),
  ]);

  const tasks = [
    { id: "members", title: "Add your guild members", description: "Build your guild directory and member profiles.", href: "/guild/members", complete: members > 0, count: members },
    { id: "team", title: "Invite your management team", description: "Give trusted guild managers and officers access.", href: "/guild/users", complete: managers > 1, count: managers },
    { id: "notifications", title: "Connect Discord notifications", description: "Send roster, bidding and guild updates to Discord.", href: "/guild/notifications", complete: Boolean(config?.rosterWebhookUrl || config?.bidWebhookUrl || config?.statsWebhookUrl || callRows[0]?.webhook_url), count: 0 },
    { id: "event", title: "Create your first event", description: "Schedule an event and start managing attendance and rosters.", href: "/events", complete: events > 0, count: events },
    { id: "resources", title: "Configure guild resources", description: "Set up resources for reservations and allocation.", href: "/guild/resources", complete: resources > 0, count: resources },
    { id: "recruitment", title: "Set up your recruitment application link", description: "Open Recruitment, generate an application link, then copy and share it with prospective members. You can reuse or revoke active links there.", href: "/guild/applicants", complete: activeInvites > 0, count: activeInvites },
  ];

  return NextResponse.json({ tasks, completed: tasks.filter(task => task.complete).length, total: tasks.length, dismissed: Boolean(progress?.dismissedAt) });
}

export async function PATCH(request: Request) {
  const auth = await getCurrentAuth();
  if (!auth) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!hasPermission(auth.role, "guild.manage")) return NextResponse.json({ error: "You do not have permission to manage guild onboarding." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { dismissed?: boolean };
  if (body.dismissed !== true) return NextResponse.json({ error: "A dismissal action is required." }, { status: 400 });
  await prisma.guildOnboardingProgress.upsert({
    where: { guildId: auth.guild.id },
    create: { id: randomUUID(), guildId: auth.guild.id, dismissedAt: new Date() },
    update: { dismissedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
