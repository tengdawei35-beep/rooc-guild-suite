import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "rooc_applicant_session";
const MAX_AGE = 60 * 60 * 2;

type Payload = {
  userId: string;
  issuedAt: number;
  expiresAt: number;
};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not configured.");
  return value;
}

function sign(encoded: string) {
  return createHmac("sha256", secret()).update(encoded).digest("base64url");
}

function encode(payload: Payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function createToken(userId: string) {
  const now = Date.now();
  const encoded = encode({ userId, issuedAt: now, expiresAt: now + MAX_AGE * 1000 });
  return `${encoded}.${sign(encoded)}`;
}

function verify(token: string) {
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;
    const expected = sign(encoded);
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Payload;
    if (!payload.userId || Date.now() >= payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setApplicantSession(userId: string) {
  const store = await cookies();
  store.set(COOKIE, createToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getApplicantSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? verify(token) : null;
}

export async function clearApplicantSession() {
  const store = await cookies();
  store.set(COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
