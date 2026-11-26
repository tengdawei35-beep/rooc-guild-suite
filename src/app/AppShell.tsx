"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Permission, UserRole } from "@/lib/permissions";
import { HMDL_MARK } from "@/lib/hmdl-brand";

type Props = {
  children: ReactNode;
  user: { username: string };
  guild: { name: string };
  role: UserRole;
  accessibleGuildCount: number;
  isPlatformAdmin: boolean;
  hasResourceSuite: boolean;
  hasCombatSimulator: boolean;
  ownMemberId: string | null;
  permissions: Permission[];
  impersonation: { mode: "USER" | "ROLE"; role: UserRole; targetUsername: string; guildName: string; adminUsername: string; expiresAt: string } | null;
};

type NavItem = { label: string; href: string; icon: string };
type NavGroup = { label: string; items: NavItem[] };

const PUBLIC_PATHS = ["/login", "/landing", "/pricing", "/apply", "/billing", "/guild/select", "/guild/switch"];

function isActive(pathname: string, href: string, searchParams: URLSearchParams) {
  const [targetPath, targetQuery] = href.split("?");
  const pathMatches = targetPath === "/" ? pathname === "/" : pathname === targetPath || pathname.startsWith(`${targetPath}/`);
  if (!pathMatches) return false;
  if (targetQuery) {
    const expected = new URLSearchParams(targetQuery);
    return [...expected.entries()].every(([key, value]) => searchParams.get(key) === value);
  }
  if (targetPath === "/events") {
    if (pathname === "/events") return !["rosters", "preferred"].includes(searchParams.get("view") ?? "");
    return pathname.startsWith("/events/") && pathname !== "/events/results";
  }
  return true;
}

export default function AppShell({
  children,
  user,
  guild,
  role,
  accessibleGuildCount,
  isPlatformAdmin,
  hasResourceSuite,
  hasCombatSimulator,
  ownMemberId,
  permissions,
  impersonation,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavigationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, searchParams]);
  const isMemberPortal = role === "MEMBER";

  if (!impersonation && PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
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
        ...(roleCan("applicants.view") ? [{ label: "Recruitment", href: "/guild/applicants", icon: "＋" }] : []),\n        ...(["ADMIN", "MANAGER"].includes(role) ? [{ label: "Applicant watchlist", href: "/guild/applicant-watchlist", icon: "◉" }] : []),
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
      items: [
        ...(roleCan("members.view")
          ? [
              { label: "Statistics", href: "/guild/statistics", icon: "▥" },
              { label: "Rankings", href: "/guild/rankings", icon: "↗" },
            ]
          : []),
        ...(hasCombatSimulator ? [{ label: "Combat simulator", href: "/combat-simulator", icon: "⚔" }] : []),
      ],
    },
    {
      label: "CONFIGURATION",
      items: roleCan("guild.manage")
        ? [
            { label: "Guild settings", href: "/guild", icon: "⚙" },
            { label: "Discord notifications", href: "/guild/notifications", icon: "◉" },
            ...(!impersonation ? [{ label: "Subscription", href: "/billing/new", icon: "▤" }] : []),
          ]
        : [],
    },
  ];

  function roleCan(permission: Permission) {
    return permissions.includes(permission);
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
              const active = isActive(pathname, item.href, new URLSearchParams(searchParams.toString()));
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
          <Link href="/admin" onClick={() => setMobileOpen(false)} className={`hmdl-nav-link${pathname === "/admin" ? " is-active" : ""}`}>
            <span className="hmdl-nav-icon" aria-hidden="true">⌘</span>
            <span>Platform admin</span>
          </Link>
          <Link href="/admin/subscriptions" onClick={() => setMobileOpen(false)} aria-current={pathname.startsWith("/admin/subscriptions") ? "page" : undefined} className={`hmdl-nav-link${pathname.startsWith("/admin/subscriptions") ? " is-active" : ""}`}>
            <span className="hmdl-nav-icon" aria-hidden="true">▤</span>
            <span>Subscriptions</span>
          </Link>
        </section>
      )}
    </nav>
  );

  return (
    <div className={`hmdl-app-shell ${isMemberPortal ? "hmdl-member-portal" : "hmdl-management"}`}>
      <aside className="hmdl-sidebar">
        <Link href="/" className="hmdl-brand" aria-label="Heimdall home">
          <span className="hmdl-brand-mark"><img src={HMDL_MARK} alt="" /></span>
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
            <span className="hmdl-brand-mark"><img src={HMDL_MARK} alt="" /></span><span className="hmdl-brand-copy"><strong>HEIMDALL</strong><small>{guild.name}</small></span>
          </Link>
          <button ref={mobileMenuButtonRef} type="button" className="hmdl-mobile-menu-button" aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileOpen} aria-controls="hmdl-mobile-navigation" onClick={() => setMobileOpen((open) => !open)}>
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </header>
        {mobileOpen && <div ref={mobileNavigationRef} className="hmdl-mobile-navigation" id="hmdl-mobile-navigation">{navigation}</div>}
        <main className="hmdl-shell-content">
          {impersonation && <div role="status" className="mb-5 flex flex-col gap-3 rounded-xl border border-orange-500/50 bg-orange-950/80 px-4 py-3 text-orange-100 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-widest text-orange-300">Impersonation mode · temporary access</p><p className="mt-1 text-sm font-semibold">Viewing {impersonation.guildName} as {impersonation.mode === "ROLE" && impersonation.role === "ADMIN" ? "Guild Owner" : impersonation.role.charAt(0) + impersonation.role.slice(1).toLowerCase()} · {impersonation.targetUsername}</p><p className="mt-1 text-xs text-orange-200/80">Original administrator: {impersonation.adminUsername} · Expires {new Date(impersonation.expiresAt).toLocaleTimeString()}</p></div>
            <button type="button" onClick={async () => { const response = await fetch("/api/admin/impersonation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop" }) }); if (response.ok) { router.replace("/admin/impersonation"); router.refresh(); } }} className="shrink-0 rounded-lg border border-orange-300/50 bg-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-orange-400">Exit impersonation</button>
          </div>}
          <div className="hmdl-page-guild-identity" aria-label={`Current guild: ${guild.name}`}>
            <span>{guild.name}</span>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
