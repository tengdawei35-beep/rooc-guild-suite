"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Permission, UserRole } from "@/lib/permissions";

type Props = {
  children: ReactNode;
  user: { username: string };
  guild: { name: string };
  role: UserRole;
  accessibleGuildCount: number;
  isPlatformAdmin: boolean;
  hasResourceSuite: boolean;
  ownMemberId: string | null;
};

type NavItem = { label: string; href: string; icon: string };
type NavGroup = { label: string; items: NavItem[] };

const PUBLIC_PATHS = ["/login", "/landing", "/pricing", "/apply", "/billing", "/guild/select", "/guild/switch"];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({
  children,
  user,
  guild,
  role,
  accessibleGuildCount,
  isPlatformAdmin,
  hasResourceSuite,
  ownMemberId,
}: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMemberPortal = role === "MEMBER";

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return <>{children}</>;
  }

  const memberGroups: NavGroup[] = [
    {
      label: "MY GUILD",
      items: [
        { label: "Home", href: "/", icon: "⌂" },
        { label: "Events", href: "/events", icon: "▦" },
        { label: "Guild members", href: "/guild/members", icon: "♧" },
        ...(ownMemberId ? [{ label: "My profile", href: `/guild/members/${ownMemberId}`, icon: "◎" }] : []),
      ],
    },
    {
      label: "MY ACTIVITY",
      items: [
        { label: "Apply leave", href: "/guild/members/leave", icon: "◷" },
      ],
    },
  ];

  const managementGroups: NavGroup[] = [
    {
      label: "OVERVIEW",
      items: [{ label: "Dashboard", href: "/", icon: "⌂" }],
    },
    {
      label: "PEOPLE",
      items: [
        ...(roleCan("members.view") ? [{ label: "Members", href: "/guild/members", icon: "♧" }] : []),
        ...(roleCan("applicants.view") ? [{ label: "Recruitment", href: "/guild/applicants", icon: "＋" }] : []),
        ...(roleCan("users.view") ? [{ label: "Users & roles", href: "/guild/users", icon: "◎" }] : []),
        ...(roleCan("leave.manageAny") ? [{ label: "Leave & availability", href: "/guild/members/leave/history", icon: "◷" }] : []),
      ],
    },
    {
      label: "OPERATIONS",
      items: [
        ...(roleCan("events.view") ? [{ label: "Events", href: "/events", icon: "▦" }] : []),
        ...(roleCan("rosters.view") ? [{ label: "Rosters", href: "/events?view=rosters", icon: "☷" }] : []),
        ...(roleCan("events.view") ? [{ label: "Call To Arms", href: "/guild/calls", icon: "⌁" }] : []),
        ...(roleCan("events.view") ? [{ label: "Event results", href: "/events/results", icon: "▤" }] : []),
      ],
    },
    {
      label: "RESOURCES",
      items: hasResourceSuite && roleCan("allocation.view")
        ? [
            { label: "Resource overview", href: "/guild/resources", icon: "◇" },
            { label: "Opt-ins", href: "/guild/resources/opt-ins", icon: "☑" },
            { label: "Reservations", href: "/guild/reservations", icon: "▣" },
            { label: "Allocation", href: "/allocation", icon: "⇄" },
            { label: "Bidding", href: "/bid-pages", icon: "⌁" },
            { label: "History & audit", href: "/allocation/history", icon: "↺" },
          ]
        : [],
    },
    {
      label: "INSIGHTS",
      items: roleCan("members.view")
        ? [
            { label: "Statistics", href: "/guild/statistics", icon: "▥" },
            { label: "Rankings", href: "/guild/rankings", icon: "↗" },
          ]
        : [],
    },
    {
      label: "CONFIGURATION",
      items: roleCan("guild.manage")
        ? [
            { label: "Guild settings", href: "/guild", icon: "⚙" },
            { label: "Discord notifications", href: "/guild/notifications", icon: "◉" },
          ]
        : [],
    },
  ];

  function roleCan(permission: Permission) {
    // The server has already computed the effective role; this mirrors the existing
    // role matrix only for navigation visibility. Every destination still enforces
    // its own server-side authorization.
    if (role === "ADMIN") return true;
    const grants: Record<UserRole, string[]> = {
      ADMIN: [],
      MANAGER: ["members.view", "applicants.view", "users.view", "leave.manageAny", "events.view", "rosters.view", "allocation.view", "guild.manage"],
      OFFICER: ["members.view", "applicants.view", "users.view", "leave.manageAny", "events.view", "rosters.view", "allocation.view"],
      MEMBER: ["members.view", "events.view", "rosters.view"],
    };
    return grants[role].includes(permission);
  }

  const groups = isMemberPortal ? memberGroups : managementGroups;
  const roleLabel = role.charAt(0) + role.slice(1).toLowerCase();

  const navigation = (
    <nav aria-label={isMemberPortal ? "Member navigation" : "Management navigation"} className="hmdl-shell-nav">
      {groups.map((group) => group.items.length > 0 ? (
        <section key={group.label} className="hmdl-nav-group">
          <p className="hmdl-nav-group-label">{group.label}</p>
          <div className="hmdl-nav-items">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href.split("?")[0]);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`hmdl-nav-link${active ? " is-active" : ""}`}
                >
                  <span className="hmdl-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null)}
      {isPlatformAdmin && (
        <section className="hmdl-nav-group">
          <p className="hmdl-nav-group-label">PLATFORM</p>
          <Link href="/admin" onClick={() => setMobileOpen(false)} className={`hmdl-nav-link${pathname.startsWith("/admin") ? " is-active" : ""}`}>
            <span className="hmdl-nav-icon" aria-hidden="true">⌘</span>
            <span>Platform admin</span>
          </Link>
        </section>
      )}
    </nav>
  );

  return (
    <div className={`hmdl-app-shell ${isMemberPortal ? "hmdl-member-portal" : "hmdl-management"}`}>
      <aside className="hmdl-sidebar">
        <Link href="/" className="hmdl-brand" aria-label="Heimdall home">
          <span className="hmdl-brand-mark">H</span>
          <span className="hmdl-brand-copy"><strong>HEIMDALL</strong><small>GUILD MANAGEMENT</small></span>
        </Link>
        <div className="hmdl-sidebar-context">
          <span className="hmdl-context-label">CURRENT GUILD</span>
          <span className="hmdl-context-name" title={guild.name}>{guild.name}</span>
          <span className="hmdl-context-role">{isMemberPortal ? "Member portal" : "Management workspace"}</span>
        </div>
        {navigation}
        <div className="hmdl-sidebar-footer">
          <div className="hmdl-user-avatar" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</div>
          <div className="hmdl-user-details"><strong>{user.username}</strong><span>{roleLabel}</span></div>
          {accessibleGuildCount > 1 && <Link href="/guild/switch" className="hmdl-switch-link" title="Switch guild" aria-label="Switch guild">⇄</Link>}
          <form action="/api/auth/logout" method="POST"><button className="hmdl-logout" type="submit" aria-label="Log out" title="Log out">↪</button></form>
        </div>
      </aside>

      <div className="hmdl-shell-main">
        <header className="hmdl-mobile-header">
          <Link href="/" className="hmdl-brand">
            <span className="hmdl-brand-mark">H</span><span className="hmdl-brand-copy"><strong>HEIMDALL</strong><small>{guild.name}</small></span>
          </Link>
          <button type="button" className="hmdl-mobile-menu-button" aria-expanded={mobileOpen} aria-controls="hmdl-mobile-navigation" onClick={() => setMobileOpen((open) => !open)}>
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </header>
        {mobileOpen && <div className="hmdl-mobile-navigation" id="hmdl-mobile-navigation">{navigation}</div>}
        <main className="hmdl-shell-content">{children}</main>
      </div>
    </div>
  );
}
