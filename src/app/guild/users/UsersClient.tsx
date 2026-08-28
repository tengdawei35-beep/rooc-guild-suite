"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

type UserRole =
  | "ADMIN"
  | "MANAGER"
  | "OFFICER"
  | "MEMBER";

type GuildUser = {
  id: string;
  membershipId: string;
  discordId: string;
  username: string;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;

  guildMember: {
    id: string;
    displayName: string;
    characterName: string | null;
    job: string | null;
    active: boolean;
  } | null;
};

type CurrentUser = {
  id: string;
  role: UserRole;
};

const ROLE_ORDER: UserRole[] = [
  "ADMIN",
  "MANAGER",
  "OFFICER",
  "MEMBER",
];

const ROLE_DESCRIPTIONS: Record<
  UserRole,
  string
> = {
  ADMIN:
    "Full administrative access to the guild.",

  MANAGER:
    "Manage guild members, events, rosters and allocation.",

  OFFICER:
    "Manage guild members, events, rosters and allocation operations.",

  MEMBER:
    "View guild data and edit their own profile.",
};

export default function UsersClient() {
  const [users, setUsers] =
    useState<GuildUser[]>([]);

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [showAdd, setShowAdd] =
    useState(false);

  const [discordId, setDiscordId] =
    useState("");

  const [newRole, setNewRole] =
    useState<UserRole>("MEMBER");

  const [adding, setAdding] =
    useState(false);

  const [savingUserId, setSavingUserId] =
    useState<string | null>(null);

  const [removingUserId, setRemovingUserId] =
    useState<string | null>(null);

  // =========================================================
  // LOAD USERS
  // =========================================================

  async function loadUsers() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/guild/users",
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to load users."
        );
      }

      setUsers(
        Array.isArray(data.users)
          ? data.users
          : []
      );

      if (
        data.currentUser &&
        typeof data.currentUser.id ===
          "string" &&
        isUserRole(
          data.currentUser.role
        )
      ) {
        setCurrentUser({
          id:
            data.currentUser.id,

          role:
            data.currentUser.role,
        });
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load users."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  // =========================================================
  // PERMISSIONS
  // =========================================================

  /*
   * User-management access is intentionally restricted to:
   *
   * ADMIN
   * MANAGER
   *
   * Officers can manage guild operations, but cannot change
   * application access roles.
   */

  const canManageUsers =
    currentUser?.role ===
      "ADMIN" ||
    currentUser?.role ===
      "MANAGER";

  /*
   * Determines which roles the current user may assign.
   *
   * ADMIN:
   *   MANAGER
   *   OFFICER
   *   MEMBER
   *
   * MANAGER:
   *   OFFICER
   *   MEMBER
   *
   * OFFICER:
   *   none
   *
   * MEMBER:
   *   none
   *
   * ADMIN is deliberately excluded as a selectable target role.
   */

  function canAssignRole(
    role: UserRole
  ) {
    if (
      currentUser?.role ===
      "ADMIN"
    ) {
      return (
        role === "MANAGER" ||
        role === "OFFICER" ||
        role === "MEMBER"
      );
    }

    if (
      currentUser?.role ===
      "MANAGER"
    ) {
      return (
        role === "OFFICER" ||
        role === "MEMBER"
      );
    }

    return false;
  }

  /*
   * Determines whether the current user can manage this
   * particular guild user.
   *
   * This mirrors the server-side hierarchy:
   *
   * ADMIN
   *   -> MANAGER / OFFICER / MEMBER
   *
   * MANAGER
   *   -> OFFICER / MEMBER
   *
   * OFFICER
   *   -> none
   *
   * MEMBER
   *   -> none
   */

  function canManageTarget(
    user: GuildUser
  ) {
    if (!canManageUsers) {
      return false;
    }

    /*
     * A user cannot modify their own guild
     * membership from this page.
     */

    if (
      user.id ===
      currentUser?.id
    ) {
      return false;
    }

    if (
      currentUser?.role ===
      "ADMIN"
    ) {
      return (
        user.role !==
        "ADMIN"
      );
    }

    if (
      currentUser?.role ===
      "MANAGER"
    ) {
      return (
        user.role === "OFFICER" ||
        user.role === "MEMBER"
      );
    }

    return false;
  }

  // =========================================================
  // ADD USER
  // =========================================================

  async function addUser(
    event: React.FormEvent
  ) {
    event.preventDefault();

    const trimmed =
      discordId.trim();

    if (!trimmed) {
      setError(
        "Enter a Discord user ID."
      );
      return;
    }

    if (
      !canManageUsers
    ) {
      setError(
        "You do not have permission to add users."
      );
      return;
    }

    if (
      !canAssignRole(
        newRole
      )
    ) {
      setError(
        "You do not have permission to assign this role."
      );
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/guild/users",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              discordId:
                trimmed,

              role:
                newRole,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to add user."
        );
      }

      setDiscordId("");
      setNewRole("MEMBER");
      setShowAdd(false);

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to add user."
      );
    } finally {
      setAdding(false);
    }
  }

  // =========================================================
  // UPDATE ROLE
  // =========================================================

  async function updateRole(
    user: GuildUser,
    role: UserRole
  ) {
    if (
      role === user.role
    ) {
      return;
    }

    if (
      !canManageTarget(
        user
      )
    ) {
      return;
    }

    if (
      !canAssignRole(
        role
      )
    ) {
      setError(
        "You do not have permission to assign this role."
      );
      return;
    }

    setSavingUserId(user.id);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/guild/users/${user.id}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              role,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to update role."
        );
      }

      setUsers(
        (current) =>
          current.map(
            (item) =>
              item.id === user.id
                ? {
                    ...item,
                    role,
                  }
                : item
          )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update role."
      );
    } finally {
      setSavingUserId(null);
    }
  }

  // =========================================================
  // REMOVE USER
  // =========================================================

  async function removeUser(
    user: GuildUser
  ) {
    if (
      !canManageTarget(
        user
      )
    ) {
      return;
    }

    const name =
      user.username ||
      user.discordId;

    const confirmed =
      window.confirm(
        `Remove ${name} from this guild?\n\nTheir Discord account and data will not be deleted. Only their access to this guild will be removed.`
      );

    if (!confirmed) {
      return;
    }

    setRemovingUserId(user.id);
    setError(null);

    try {
      const response =
        await fetch(
          `/api/guild/users/${user.id}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Failed to remove user."
        );
      }

      setUsers(
        (current) =>
          current.filter(
            (item) =>
              item.id !== user.id
          )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove user."
      );
    } finally {
      setRemovingUserId(null);
    }
  }

  // =========================================================
  // ROLE COUNTS
  // =========================================================

  const roleCounts =
    useMemo(() => {
      return {
        ADMIN: users.filter(
          (user) =>
            user.role === "ADMIN"
        ).length,

        MANAGER: users.filter(
          (user) =>
            user.role === "MANAGER"
        ).length,

        OFFICER: users.filter(
          (user) =>
            user.role === "OFFICER"
        ).length,

        MEMBER: users.filter(
          (user) =>
            user.role === "MEMBER"
        ).length,
      };
    }, [users]);

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/guild"
              className="text-sm text-zinc-500 transition hover:text-white"
            >
              ← Guild Dashboard
            </Link>

            <p className="mt-6 text-sm font-medium uppercase tracking-widest text-zinc-500">
              Access Control
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Users
            </h1>

            <p className="mt-2 text-zinc-400">
              Manage Discord accounts and
              their access to this guild.
            </p>
          </div>

          {canManageUsers && (
            <button
              type="button"
              onClick={() =>
                setShowAdd(
                  (value) => !value
                )
              }
              className="rounded-lg bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              {showAdd
                ? "Cancel"
                : "Add User"}
            </button>
          )}
        </div>

        {/* ===================================================
            ERROR
        =================================================== */}

        {error && (
          <div className="mt-6 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ===================================================
            ADD USER
        =================================================== */}

        {showAdd &&
          canManageUsers && (
            <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-lg font-semibold">
                Add Guild User
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                The Discord account must have
                logged into ROO Guild Suite at
                least once before it can be
                added.
              </p>

              <form
                onSubmit={addUser}
                className="mt-6 grid gap-5 lg:grid-cols-3"
              >
                <div className="lg:col-span-2">
                  <label
                    htmlFor="discordId"
                    className="block text-sm font-medium text-zinc-300"
                  >
                    Discord User ID
                  </label>

                  <input
                    id="discordId"
                    value={discordId}
                    onChange={(event) =>
                      setDiscordId(
                        event.target.value
                      )
                    }
                    placeholder="123456789012345678"
                    disabled={adding}
                    className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-400 disabled:opacity-50"
                  />

                  <p className="mt-2 text-xs text-zinc-600">
                    Discord → right-click the
                    user → Copy User ID.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="newRole"
                    className="block text-sm font-medium text-zinc-300"
                  >
                    Role
                  </label>

                  <select
                    id="newRole"
                    value={newRole}
                    onChange={(event) =>
                      setNewRole(
                        event.target
                          .value as UserRole
                      )
                    }
                    disabled={adding}
                    className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-zinc-400 disabled:opacity-50"
                  >
                    {ROLE_ORDER.map(
                      (role) =>
                        canAssignRole(
                          role
                        ) && (
                          <option
                            key={role}
                            value={role}
                          >
                            {formatRole(
                              role
                            )}
                          </option>
                        )
                    )}
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <button
                    type="submit"
                    disabled={
                      adding ||
                      !discordId.trim()
                    }
                    className="rounded-lg bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {adding
                      ? "Adding..."
                      : "Add User"}
                  </button>
                </div>
              </form>
            </section>
          )}

        {/* ===================================================
            ROLE SUMMARY
        =================================================== */}

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_ORDER.map(
            (role) => (
              <div
                key={role}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <p className="text-xs uppercase tracking-wider text-zinc-600">
                  {formatRole(role)}
                </p>

                <p className="mt-1 text-2xl font-semibold">
                  {roleCounts[role]}
                </p>
              </div>
            )
          )}
        </section>

        {/* ===================================================
            USERS
        =================================================== */}

        <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-6 py-5">
            <h2 className="text-lg font-semibold">
              Guild Access
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              {users.length}{" "}
              {users.length === 1
                ? "user"
                : "users"}{" "}
              currently have access.
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-16 text-center text-sm text-zinc-600">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-zinc-500">
                No users have access to this
                guild yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {users.map(
                (user) => {
                  const isCurrentUser =
                    user.id ===
                    currentUser?.id;

                  const canManage =
                    canManageTarget(
                      user
                    );

                  const isSaving =
                    savingUserId ===
                    user.id;

                  const isRemoving =
                    removingUserId ===
                    user.id;

                  return (
                    <div
                      key={user.id}
                      className="px-6 py-5"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        {/* USER */}

                        <div className="flex min-w-0 items-center gap-4">
                          {user.avatarUrl ? (
                            <img
                              src={
                                user.avatarUrl
                              }
                              alt=""
                              className="h-11 w-11 rounded-full"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-400">
                              {user.username
                                .slice(
                                  0,
                                  1
                                )
                                .toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-medium text-zinc-200">
                                {
                                  user.username
                                }
                              </p>

                              {isCurrentUser && (
                                <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
                                  You
                                </span>
                              )}

                              <RoleBadge
                                role={
                                  user.role
                                }
                              />
                            </div>

                            <p className="mt-1 text-xs text-zinc-600">
                              Discord ID:{" "}
                              {
                                user.discordId
                              }
                            </p>

                            {user.guildMember ? (
                              <p className="mt-1 text-sm text-zinc-500">
                                Linked character:{" "}
                                <span className="text-zinc-300">
                                  {
                                    user
                                      .guildMember
                                      .characterName ??
                                    user
                                      .guildMember
                                      .displayName
                                  }
                                </span>
                              </p>
                            ) : (
                              <p className="mt-1 text-sm text-zinc-700">
                                No member profile linked
                              </p>
                            )}
                          </div>
                        </div>

                        {/* CONTROLS */}

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          {isCurrentUser ? (
                            <span className="text-sm text-zinc-600">
                              Your account
                            </span>
                          ) : canManage ? (
                            <>
                              <select
                                value={
                                  user.role
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateRole(
                                    user,
                                    event
                                      .target
                                      .value as UserRole
                                  )
                                }
                                disabled={
                                  isSaving ||
                                  isRemoving
                                }
                                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-zinc-500 disabled:opacity-50"
                              >
                                {ROLE_ORDER.map(
                                  (
                                    role
                                  ) =>
                                    role ===
                                      user.role ||
                                    canAssignRole(
                                      role
                                    ) ? (
                                      <option
                                        key={
                                          role
                                        }
                                        value={
                                          role
                                        }
                                      >
                                        {formatRole(
                                          role
                                        )}
                                      </option>
                                    ) : null
                                )}
                              </select>

                              <button
                                type="button"
                                onClick={() =>
                                  removeUser(
                                    user
                                  )
                                }
                                disabled={
                                  isSaving ||
                                  isRemoving
                                }
                                className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-400 transition hover:bg-red-950/40 disabled:opacity-50"
                              >
                                {isRemoving
                                  ? "Removing..."
                                  : "Remove Access"}
                              </button>
                            </>
                          ) : (
                            <span className="text-sm text-zinc-600">
                              View only
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* ===================================================
            ROLE INFORMATION
        =================================================== */}

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">
            Guild Roles
          </h2>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {ROLE_ORDER.map(
              (role) => (
                <div
                  key={role}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                >
                  <div className="flex items-center gap-3">
                    <RoleBadge
                      role={role}
                    />

                    <span className="text-sm font-medium text-zinc-300">
                      {formatRole(role)}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-zinc-500">
                    {
                      ROLE_DESCRIPTIONS[
                        role
                      ]
                    }
                  </p>
                </div>
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

// =============================================================
// ROLE VALIDATION
// =============================================================

function isUserRole(
  value: unknown
): value is UserRole {
  return (
    value === "ADMIN" ||
    value === "MANAGER" ||
    value === "OFFICER" ||
    value === "MEMBER"
  );
}

// =============================================================
// ROLE BADGE
// =============================================================

function RoleBadge({
  role,
}: {
  role: UserRole;
}) {
  return (
    <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
      {formatRole(role)}
    </span>
  );
}

// =============================================================
// ROLE LABEL
// =============================================================

function formatRole(
  role: UserRole
) {
  return (
    role.charAt(0) +
    role.slice(1).toLowerCase()
  );
}