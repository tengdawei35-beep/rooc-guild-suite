import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

import { prisma } from "@/lib/prisma";
import { getActiveImpersonation } from "@/lib/impersonation";

const PLATFORM_SESSION_COOKIE = "rooc_platform_session";
const PLATFORM_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type PlatformSessionPayload = {
  userId: string;
  issuedAt: number;
  expiresAt: number;
  sessionVersion?: number;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured.");
  return secret;
}

function encode(payload: PlatformSessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function sign(encoded: string) {
  return createHmac("sha256", getSessionSecret()).update(encoded).digest("base64url");
}

function createToken(payload: PlatformSessionPayload) {
  const encoded = encode(payload);
  return `${encoded}.${sign(encoded)}`;
}

function verifyToken(token: string): PlatformSessionPayload | null {
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;
    const expected = sign(encoded);
    if (signature.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PlatformSessionPayload;
    if (!payload.userId || !payload.expiresAt || Date.now() >= payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setPlatformUserSession(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  if (!user) throw new Error("Cannot create a platform session for an unknown user.");
  const now = Date.now();
  const token = createToken({
    userId,
    issuedAt: now,
    expiresAt: now + PLATFORM_SESSION_MAX_AGE * 1000,
    sessionVersion: user.sessionVersion,
  });

  const cookieStore = await cookies();
  cookieStore.set(PLATFORM_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PLATFORM_SESSION_MAX_AGE,
  });
}

export async function getCurrentPlatformUser() {
  if (await getActiveImpersonation()) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(PLATFORM_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = verifyToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.sessionVersion !== (session.sessionVersion ?? 0)) return null;
  return user;
}

export async function destroyPlatformUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PLATFORM_SESSION_COOKIE)?.value;
  const session = token ? verifyToken(token) : null;
  if (session) {
    await prisma.user.updateMany({ where: { id: session.userId, sessionVersion: session.sessionVersion ?? 0 }, data: { sessionVersion: { increment: 1 } } });
  }
  cookieStore.set(PLATFORM_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
