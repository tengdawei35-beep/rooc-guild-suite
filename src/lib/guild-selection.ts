import { createHmac, timingSafeEqual } from "crypto";

const SELECTION_MAX_AGE = 5 * 60 * 1000;

type GuildSelectionPayload = {
  userId: string;
  expiresAt: number;
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  return secret;
}

function encode(payload: GuildSelectionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function sign(encoded: string) {
  return createHmac("sha256", getSecret()).update(encoded).digest("base64url");
}

export function createGuildSelectionToken(userId: string) {
  const encoded = encode({
    userId,
    expiresAt: Date.now() + SELECTION_MAX_AGE,
  });

  return `${encoded}.${sign(encoded)}`;
}

export function verifyGuildSelectionToken(token: string): GuildSelectionPayload | null {
  try {
    const [encoded, signature] = token.split(".");

    if (!encoded || !signature) {
      return null;
    }

    const expected = sign(encoded);

    if (signature.length !== expected.length) {
      return null;
    }

    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as GuildSelectionPayload;

    if (!payload.userId || !payload.expiresAt || Date.now() >= payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export const GUILD_SELECTION_COOKIE = "rooc_guild_selection";
