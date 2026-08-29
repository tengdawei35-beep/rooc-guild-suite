import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const PLATFORM_USER_COOKIE = "rooc_platform_user";

export async function getCurrentPlatformUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(PLATFORM_USER_COOKIE)?.value;
  if (!userId) return null;

  return prisma.user.findUnique({ where: { id: userId } });
}

export async function setPlatformUserSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(PLATFORM_USER_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
