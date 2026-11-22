import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/lib/permissions";

const COOKIE = "rooc_admin_impersonation";
const MAX_DURATION_MS = 30 * 60 * 1000;
type Payload = { sessionId: string; adminUserId: string; expiresAt: number };
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not configured.");
  return value;
}
function sign(encoded: string) { return createHmac("sha256", secret()).update(encoded).digest("base64url"); }
function encode(payload: Payload) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${value}.${sign(value)}`;
}
function decode(token: string): Payload | null {
  try {
    const [value, signature] = token.split(".");
    if (!value || !signature) return null;
    const expected = sign(value);
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Payload;
    if (!payload.sessionId || !payload.adminUserId || !payload.expiresAt || Date.now() >= payload.expiresAt) return null;
    return payload;
  } catch { return null; }
}
export async function getActiveImpersonation() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const payload = decode(token);
  if (!payload) return null;
  const session = await prisma.adminImpersonationSession.findUnique({ where: { id: payload.sessionId } });
  if (!session || session.adminUserId !== payload.adminUserId || session.endedAt || session.expiresAt.getTime() <= Date.now()) return null;
  return session;
}
export async function startImpersonation(input: { adminUserId: string; targetUserId: string; guildId: string; role: UserRole; mode: "USER" | "ROLE" }) {
  const expiresAt = new Date(Date.now() + MAX_DURATION_MS);
  const session = await prisma.adminImpersonationSession.create({ data: { ...input, expiresAt } });
  await prisma.adminImpersonationAuditLog.create({ data: {
    sessionId: session.id, actorUserId: input.adminUserId, action: "SESSION_STARTED",
    metadata: { mode: input.mode, role: input.role, guildId: input.guildId, targetUserId: input.targetUserId },
  } });
  (await cookies()).set(COOKIE, encode({ sessionId: session.id, adminUserId: input.adminUserId, expiresAt: expiresAt.getTime() }), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 60,
  });
  return session;
}
export async function stopImpersonation(reason = "ADMIN_EXIT") {
  const active = await getActiveImpersonation();
  if (active) {
    await prisma.adminImpersonationSession.update({ where: { id: active.id }, data: { endedAt: new Date(), endedReason: reason } });
    await prisma.adminImpersonationAuditLog.create({ data: { sessionId: active.id, actorUserId: active.adminUserId, action: "SESSION_ENDED", metadata: { reason } } });
  }
  (await cookies()).set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
export function getImpersonationCookieName() { return COOKIE; }
export function isImpersonationRole(value: unknown): value is UserRole {
  return value === "ADMIN" || value === "MANAGER" || value === "OFFICER" || value === "MEMBER";
}
