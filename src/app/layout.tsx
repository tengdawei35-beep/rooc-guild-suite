import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { getCurrentAuth } from "@/lib/auth";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { hasGuildModule, RESOURCE_SUITE_MODULE } from "@/lib/auth/modules";
import { prisma } from "@/lib/prisma";
import AppShell from "./AppShell";
import NotificationWatcher from "./notifications/NotificationWatcher";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Heimdall",
  description: "Guild management suite for Ragnarok Online Origin Classic and future games.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const auth = await getCurrentAuth();
  const [accessibleGuildCount, isPlatformAdmin, hasResourceSuite] = auth
    ? await Promise.all([
        prisma.guildMembership.count({ where: { userId: auth.user.id } }),
        getPlatformAdmin().then(Boolean),
        hasGuildModule(auth.guild.id, RESOURCE_SUITE_MODULE),
      ])
    : [0, false, false];

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
          >
            {children}
          </AppShell>
        ) : children}
        <NotificationWatcher />
      </body>
    </html>
  );
}
