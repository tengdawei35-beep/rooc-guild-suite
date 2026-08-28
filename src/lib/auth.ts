import { cookies } from "next/headers";
import {
  createHmac,
  timingSafeEqual,
} from "crypto";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const SESSION_COOKIE =
  "rooc_session";

const SESSION_MAX_AGE =
  60 * 60 * 24 * 30; // 30 days

type SessionPayload = {
  userId: string;
  guildId: string;
  issuedAt: number;
  expiresAt: number;
};

function getSessionSecret() {
  const secret =
    process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not configured."
    );
  }

  return secret;
}

// =============================================================
// SIGN / VERIFY SESSION
// =============================================================

function encodePayload(
  payload: SessionPayload
) {
  return Buffer.from(
    JSON.stringify(payload)
  ).toString("base64url");
}

function signPayload(
  encoded: string
) {
  return createHmac(
    "sha256",
    getSessionSecret()
  )
    .update(encoded)
    .digest("base64url");
}

function createSessionToken(
  payload: SessionPayload
) {
  const encoded =
    encodePayload(payload);

  const signature =
    signPayload(encoded);

  return `${encoded}.${signature}`;
}

function verifySessionToken(
  token: string
): SessionPayload | null {
  try {
    const [encoded, signature] =
      token.split(".");

    if (
      !encoded ||
      !signature
    ) {
      return null;
    }

    const expected =
      signPayload(encoded);

    if (
      signature.length !==
      expected.length
    ) {
      return null;
    }

    const valid =
      signature.length ===
        expected.length &&
      timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      );

    if (!valid) {
      return null;
    }

    const payload =
      JSON.parse(
        Buffer.from(
          encoded,
          "base64url"
        ).toString("utf8")
      ) as SessionPayload;

    if (
      !payload.userId ||
      !payload.guildId ||
      !payload.expiresAt
    ) {
      return null;
    }

    if (
      Date.now() >=
      payload.expiresAt
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// =============================================================
// CREATE SESSION
// =============================================================

export async function createSession(
  userId: string,
  guildId: string
) {
  const now =
    Date.now();

  const payload: SessionPayload =
    {
      userId,
      guildId,
      issuedAt: now,
      expiresAt:
        now +
        SESSION_MAX_AGE *
          1000,
    };

  const token =
    createSessionToken(
      payload
    );

  const cookieStore =
    await cookies();

  cookieStore.set(
    SESSION_COOKIE,
    token,
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge:
        SESSION_MAX_AGE,
    }
  );
}

// =============================================================
// DESTROY SESSION
// =============================================================

export async function destroySession() {
  const cookieStore =
    await cookies();

  cookieStore.set(
    SESSION_COOKIE,
    "",
    {
      httpOnly: true,
      secure:
        process.env.NODE_ENV ===
        "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    }
  );
}

// =============================================================
// CURRENT SESSION
// =============================================================

export async function getSession() {
  const cookieStore =
    await cookies();

  const token =
    cookieStore.get(
      SESSION_COOKIE
    )?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(
    token
  );
}

// =============================================================
// CURRENT USER + GUILD
// =============================================================

export async function getCurrentAuth() {
  const session =
    await getSession();

  if (!session) {
    return null;
  }

  const membership =
    await prisma.guildMembership.findUnique(
      {
        where: {
          userId_guildId: {
            userId:
              session.userId,

            guildId:
              session.guildId,
          },
        },

        include: {
          user: true,
          guild: true,
        },
      }
    );

  if (!membership) {
    return null;
  }

  return {
    user:
      membership.user,

    guild:
      membership.guild,

    membership,

    role:
      membership.role,
  };
}

// =============================================================
// REQUIRE AUTHENTICATION
// =============================================================

export async function requireAuth() {
  const auth =
    await getCurrentAuth();

  if (!auth) {
    throw new Error(
      "UNAUTHORIZED"
    );
  }

  return auth;
}

// =============================================================
// REQUIRE PAGE AUTHENTICATION
// =============================================================

export async function requirePageAuth() {
  const auth =
    await getCurrentAuth();

  if (!auth) {
    redirect("/login");
  }

  return auth;
}

// =============================================================
// PERMISSIONS
// =============================================================

export type Permission =
  | "members.view"
  | "members.edit"
  | "members.delete"
  | "members.import"
  | "profile.editOwn"
  | "leave.manageOwn"
  | "leave.manageAny"
  | "rosters.view"
  | "rosters.edit"
  | "allocation.view"
  | "allocation.run"
  | "users.view"
  | "users.manage"
  | "guild.manage";

export function hasPermission(
  role:
    | "LEADER"
    | "COUNCIL"
    | "OFFICER"
    | "MEMBER",
  permission: Permission
) {
  if (
    role ===
    "LEADER"
  ) {
    return true;
  }

  switch (
    permission
  ) {
    case "members.view":
    case "profile.editOwn":
    case "leave.manageOwn":
    case "rosters.view":
    case "allocation.view":
      return true;

    case "members.edit":
    case "members.delete":
    case "members.import":
      return (
        role ===
          "COUNCIL" ||
        role ===
          "OFFICER"
      );

    case "leave.manageAny":
      return (
        role ===
          "COUNCIL" ||
        role ===
          "OFFICER"
      );

    case "rosters.edit":
      return (
        role ===
        "COUNCIL"
      );

    case "allocation.run":
      return (
        role ===
          "COUNCIL" ||
        role ===
          "OFFICER"
      );

    case "users.view":
    case "users.manage":
      return (
        role ===
        "OFFICER"
      );

    case "guild.manage":
      return false;

    default:
      return false;
  }
}

export async function requirePermission(
  permission: Permission
) {
  const auth =
    await requireAuth();

  if (
    !hasPermission(
      auth.role,
      permission
    )
  ) {
    throw new Error(
      "FORBIDDEN"
    );
  }

  return auth;
}