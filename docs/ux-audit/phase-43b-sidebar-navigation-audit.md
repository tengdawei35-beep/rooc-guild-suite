# Phase 43B — Sidebar Navigation Consistency Audit

**Date:** 22 November 2026  
**Repository:** `tengdawei35-beep/rooc-guild-suite`  
**Base:** `main` at `bfd2290c1bd7bbfbde4e433e06aeafba3ccbcf86`  
**Branch:** `fix/sidebar-navigation-redundancy`

## Objective

Now that Heimdall has a persistent role-aware sidebar, authenticated pages should not repeat navigation that is already available in that sidebar. In particular, a generic “← Dashboard” link at the top of a page consumes space, adds a second navigation pattern, and makes the page hierarchy less consistent.

## Audit coverage

- Inspected all **37 App Router page routes** in `src/app`.
- Inspected all **36 additional app-level TS/TSX component files** for navigation links rendered by client components.
- Reviewed the route visibility rules and role-specific navigation groups in `src/app/AppShell.tsx`.
- Checked for Dashboard, Guild Dashboard, parent-route, back, and home links.
- This was a static source audit; it does not claim browser-level visual regression or interaction testing.

## Navigation rule established

1. **Authenticated top-level pages:** use the sidebar as the primary navigation. Do not add a generic Dashboard/back link when the sidebar already provides a route home or to the current module.
2. **True detail/child workflows:** retain a contextual breadcrumb/back link when it returns to the parent workflow and helps preserve context (for example, an event detail back to Events, a member profile back to Members, or an allocation bid detail back to Allocation History).
3. **Pages outside the authenticated shell:** retain an explicit exit/destination where needed. `/billing/new` and `/guild/switch` are excluded from the sidebar shell by `AppShell`, so their dashboard return links remain.
4. **Primary completion actions:** retain explicit CTAs such as “Continue to dashboard” on billing success; these are workflow outcomes, not redundant back navigation.
5. Do not remove business actions or links that lead to a genuinely different workflow.

## Changes made

Removed **28 generic Dashboard links** from authenticated top-level pages:

| Route | Removed navigation |
|---|---|
| `/admin` | Dashboard |
| `/allocation` | Dashboard |
| `/allocation/history` | Dashboard links in all three conditional states |
| `/bid-pages` | Dashboard links in all three conditional states |
| `/events` | Dashboard |
| `/guild/applicants` | Dashboard |
| `/guild/members/leave` | Dashboard links in both conditional states |
| `/guild` | Dashboard links in all three conditional states |
| `/guild/rankings` | Dashboard links in both conditional states |
| `/guild/reservations` | Dashboard links in all three conditional states |
| `/guild/resources` | Dashboard links in all five conditional states |
| `/guild/resources/opt-ins` | Dashboard links in both conditional states |
| `/guild/statistics` | Back to Dashboard |

Removed **four additional duplicate parent-navigation links** from standalone top-level pages:

| Route | Removed navigation | Reason |
|---|---|---|
| `/guild/users` | Guild Dashboard → `/guild` | Guild settings and Users & roles are both directly represented in the sidebar. |
| `/guild/notifications` | Guild → `/guild` (both states) | Discord Notifications has its own sidebar destination. |
| `/events/results` | Events → `/events` | Event Results has its own sidebar destination. |

Total removed: **32 redundant navigation links**.

The cleanup also removes now-unused `next/link` imports and adjusts page-top spacing where the deleted navigation link previously created a gap.

## Contextual navigation intentionally retained

The following patterns remain because they are useful parent-workflow navigation or because the page is outside the authenticated sidebar shell:

- Member profile → Guild Members.
- Member OCR/stat update → Guild Members.
- Leave history → Guild Members.
- Call detail → Call To Arms.
- Event detail → Events.
- Allocation audit → Allocation.
- Allocation bid detail → Allocation History / Allocation.
- Resource allocation history → Resources.
- Platform admin subpages → Platform Administration.
- Billing plan selection → Dashboard (the billing route is outside the authenticated shell).
- Guild switch → Dashboard (the guild switch route is outside the authenticated shell).
- Billing success → Continue to dashboard.

## Not changed

- No routes or features were removed.
- No sidebar permissions, role visibility, authentication, API behaviour, database schema or business logic were changed.
- The sidebar structure itself was not changed.
- No links were removed from public landing/login/pricing pages unless they were explicitly duplicate authenticated navigation.

## Validation status

- Static route/component navigation scan: completed.
- Redundant Dashboard/parent-link removal: implemented on this branch.
- Unused imports and top spacing: reviewed and cleaned in affected files.
- Build, lint and browser visual validation: pending Vercel preview / CI.
- Merge and production deployment: not performed.

## Follow-up

Once the preview build is ready, validate representative management and member routes at desktop and mobile widths. Confirm that the sidebar remains visible and provides the expected navigation on all authenticated routes, and that contextual parent links remain only on detail/child workflows.
