"use client";

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

  const [activeRoleInfo, setActiveRoleInfo] =
    useState<UserRole | null>(null);

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

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");

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
  const filteredUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [user.username, user.discordId, user.guildMember?.characterName ?? "", user.guildMember?.job ?? ""].some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (roleFilter === "ALL" || user.role === roleFilter);
  });

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
    <main className="hmdl-management hmdl-users-page hmdl-user-access-workspace min-h-screen"><div className="hmdl-page">
      <header className="hmdl-users-heading"><div><p className="hmdl-eyebrow">CONFIGURATION / ACCESS CONTROL</p><h1 className="hmdl-page-title">Guild users</h1><p>Manage who can access this guild and the level of access they hold.</p></div>{canManageUsers && <button type="button" onClick={() => setShowAdd((value) => !value)} className="hmdl-btn hmdl-btn-primary">{showAdd ? "Cancel" : "＋ Add user"}</button>}</header>
      {error && <div role="alert" className="hmdl-users-error">{error}</div>}
      {showAdd && canManageUsers && <section className="hmdl-users-panel"><div className="hmdl-users-panel-heading"><div><h2>Add guild user</h2><p>The Discord account must have logged into ROO Guild Suite at least once before it can be added.</p></div></div><form onSubmit={addUser} className="hmdl-users-add-form"><div><label htmlFor="discordId" className="hmdl-label">Discord User ID</label><input id="discordId" value={discordId} onChange={(event) => setDiscordId(event.target.value)} placeholder="123456789012345678" disabled={adding} className="hmdl-field mt-2" /><p className="mt-2 text-xs text-zinc-500">Discord → right-click the user → Copy User ID.</p></div><div><label htmlFor="newRole" className="hmdl-label">Role</label><select id="newRole" value={newRole} onChange={(event) => setNewRole(event.target.value as UserRole)} disabled={adding} className="hmdl-field mt-2">{ROLE_ORDER.map((role) => canAssignRole(role) && <option key={role} value={role}>{formatRole(role)}</option>)}</select></div><button type="submit" disabled={adding || !discordId.trim()} className="hmdl-btn hmdl-btn-primary self-end">{adding ? "Adding…" : "Add user"}</button></form></section>}
      <section className="hmdl-user-role-summary" aria-label="Users by role">{ROLE_ORDER.map((role) => <div key={role} className="hmdl-user-role-card"><div className="hmdl-user-role-label"><span>{formatRole(role)}</span><button type="button" className="hmdl-role-info-button" aria-label={`About ${formatRole(role)} role`} aria-expanded={activeRoleInfo === role} aria-controls={`guild-role-info-${role.toLowerCase()}`} onClick={() => setActiveRoleInfo((current) => current === role ? null : role)}>i</button></div><strong>{roleCounts[role]}</strong>{activeRoleInfo === role && <div id={`guild-role-info-${role.toLowerCase()}`} className="hmdl-role-info-popover" role="tooltip"><p>{ROLE_DESCRIPTIONS[role]}</p>{role === "MANAGER" && <p className="hmdl-role-info-note">Managers can assign Officer and Member access. Administrator access is reserved for existing guild administrators.</p>}</div>}</div>)}</section>
      <section className="hmdl-users-panel"><div className="hmdl-users-panel-heading"><div><h2>Guild access</h2><p>{loading ? "Loading users…" : `${users.length} ${users.length === 1 ? "user" : "users"} currently have access`}</p></div><span className="hmdl-badge">{filteredUsers.length} shown</span></div>
        <div className="hmdl-users-toolbar"><input aria-label="Search guild users" className="hmdl-field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search username, Discord ID or character…" /><select aria-label="Filter by role" className="hmdl-field" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}><option value="ALL">All roles</option>{ROLE_ORDER.map((role) => <option key={role} value={role}>{formatRole(role)}</option>)}</select></div>
        {loading ? <div className="hmdl-users-empty">Loading users…</div> : users.length === 0 ? <div className="hmdl-users-empty"><strong>No users have access yet</strong><span>Guild access granted to Discord accounts will appear here.</span></div> : filteredUsers.length === 0 ? <div className="hmdl-users-empty"><strong>No matching users</strong><span>Try a different search term or role filter.</span></div> : <div className="hmdl-user-list">{filteredUsers.map((user) => { const isCurrentUser=user.id===currentUser?.id; const canManage=canManageTarget(user); const isSaving=savingUserId===user.id; const isRemoving=removingUserId===user.id; return <article key={user.id} className="hmdl-user-row"><div className="hmdl-user-identity">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="hmdl-user-photo" /> : <div className="hmdl-user-photo hmdl-user-photo-fallback">{user.username.slice(0,1).toUpperCase()}</div>}<div className="hmdl-user-copy"><div className="flex flex-wrap items-center gap-2"><strong>{user.username}</strong>{isCurrentUser && <span className="hmdl-badge">You</span>}<RoleBadge role={user.role} /></div><span>Discord ID: {user.discordId}</span>{user.guildMember ? <span>Linked character: <strong>{user.guildMember.characterName ?? "Unnamed"}</strong>{user.guildMember.job ? ` · ${user.guildMember.job}` : ""}{!user.guildMember.active ? " · Inactive" : ""}</span> : <span>No member profile linked</span>}</div></div><div className="hmdl-user-controls">{isCurrentUser ? <span className="hmdl-user-note">Your account</span> : canManage ? <><select aria-label={`Role for ${user.username}`} value={user.role} onChange={(event) => updateRole(user,event.target.value as UserRole)} disabled={isSaving||isRemoving} className="hmdl-field hmdl-role-select">{ROLE_ORDER.map((role)=>role===user.role||canAssignRole(role)?<option key={role} value={role}>{formatRole(role)}</option>:null)}</select><button type="button" onClick={()=>removeUser(user)} disabled={isSaving||isRemoving} className="hmdl-btn hmdl-btn-danger">{isRemoving?"Removing…":"Remove access"}</button></> : <span className="hmdl-user-note">View only</span>}</div></article>; })}</div>}
      </section>

    </div></main>
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