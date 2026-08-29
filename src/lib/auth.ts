import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { Permission, UserRole } from "@/lib/permissions";

const SESSION_COOKIE = "rooc_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type SessionPayload = { userId: string; guildId: string; issuedAt: number; expiresAt: number };

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured.");
  return secret;
}
function encodePayload(payload: SessionPayload) { return Buffer.from(JSON.stringify(payload)).toString("base64url"); }
function signPayload(encoded: string) { return createHmac("sha256", getSessionSecret()).update(encoded).digest("base64url"); }
function createSessionToken(payload: SessionPayload) { const encoded = encodePayload(payload); return `${encoded}.${signPayload(encoded)}`; }
function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;
    const expected = signPayload(encoded);
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId || !payload.guildId || !payload.expiresAt || Date.now() >= payload.expiresAt) return null;
    return payload;
  } catch { return null; }
}

export async function createSession(userId: string, guildId: string) {
  const now = Date.now();
  const token = createSessionToken({ userId, guildId, issuedAt: now, expiresAt: now + SESSION_MAX_AGE * 1000 });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
}
export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

async function getCurrentMembership() {
  const session = await getSession();
  if (!session) return null;
  return prisma.guildMembership.findUnique({
    where: { userId_guildId: { userId: session.userId, guildId: session.guildId } },
    include: { user: true, guild: true },
  });
}

async function hasActiveSubscription(guildId: string) {
  const subscription = await prisma.guildSubscription.findFirst({
    where: { guildId, status: { in: ["ACTIVE", "TRIALING"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }] },
    select: { id: true },
  });
  return subscription !== null;
}

/** Returns authenticated session + guild membership without requiring billing entitlement. */
export async function getCurrentAuth() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  return { user: membership.user, guild: membership.guild, membership, role: membership.role };
}

/** API/business-operation authentication: requires an active subscription. */
export async function requireAuth() {
  const auth = await getCurrentAuth();
  if (!auth) throw new Error("UNAUTHORIZED");
  if (!(await hasActiveSubscription(auth.guild.id))) throw new Error("SUBSCRIPTION_INACTIVE");
  return auth;
}

/**
 * Page authentication only verifies the user's session and guild membership.
 * Subscription entitlement is checked separately by protected functionality.
 * This allows expired users to reach the dashboard and billing pages so they
 * can renew their subscription instead of being trapped in a redirect loop.
 */
export async function requirePageAuth() {
  const auth = await getCurrentAuth();
  if (!auth) redirect("/login?error=authentication_required");
  return auth;
}

export async function requireActiveSubscription() {
  return requireAuth();
}

export { hasPermission };
export type { Permission, UserRole };
export async function requirePermission(permission: Permission) {
  const auth = await requireAuth();
  if (!hasPermission(auth.role, permission)) throw new Error("FORBIDDEN");
  return auth;
}
