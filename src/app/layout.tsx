import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { getCurrentAuth, hasPermission, type Permission } from "@/lib/auth";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { hasGuildModule, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";
import { prisma } from "@/lib/prisma";
import { getActiveImpersonation } from "@/lib/impersonation";
import AppShell from "./AppShell";
import { HMDL_MARK } from "@/lib/hmdl-brand";
import NotificationWatcher from "./notifications/NotificationWatcher";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "HMDL | Heimdall", template: "%s | HMDL" },
  applicationName: "HMDL",
  icons: { icon: [{ url: HMDL_MARK, type: "image/webp" }], shortcut: [{ url: HMDL_MARK, type: "image/webp" }], apple: [{ url: HMDL_MARK, type: "image/webp" }] },
  description: "Guild management suite for Ragnarok Online Origin Classic and future games.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const auth = await getCurrentAuth();
  const impersonation = await getActiveImpersonation();
  const navPermissionKeys: Permission[] = ["members.view", "applicants.view", "users.view", "leave.manageAny", "leave.manageOwn", "events.view", "rosters.view", "allocation.view", "guild.manage"];
  const permissions = auth ? navPermissionKeys.filter((permission) => hasPermission(auth.role, permission)) : [];
  const [accessibleGuildCount, isPlatformAdmin, hasResourceSuite, ownMember, adminUser] = auth
    ? await Promise.all([
        prisma.guildMembership.count({ where: { userId: auth.user.id } }),
        getPlatformAdmin().then(Boolean),
        hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE),
        prisma.guildMember.findFirst({
          where: {
            guildId: auth.guild.id,
            active: true,
            OR: [{ userId: auth.user.id }, { discordUserId: auth.user.discordId }],
          },
          select: { id: true },
        }),
        impersonation ? prisma.user.findUnique({ where: { id: impersonation.adminUserId }, select: { username: true } }) : Promise.resolve(null),
      ])
    : [0, false, false, null, null];

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {auth ? (
          <AppShell
            user={{ username: auth.user.username }}
            guild={{ name: auth.guild.name }}
            role={auth.role}
            accessibleGuildCount={accessibleGuildCount}
            isPlatformAdmin={isPlatformAdmin}
            hasResourceSuite={hasResourceSuite}
            ownMemberId={ownMember?.id ?? null}
            permissions={permissions}
            impersonation={impersonation ? { mode: impersonation.mode as "USER" | "ROLE", role: impersonation.role, targetUsername: auth.user.username, guildName: auth.guild.name, adminUsername: adminUser?.username ?? "Platform Admin", expiresAt: impersonation.expiresAt.toISOString() } : null}
          >
            {children}
          </AppShell>
        ) : children}
        <NotificationWatcher />
      </body>
    </html>
  );
}
