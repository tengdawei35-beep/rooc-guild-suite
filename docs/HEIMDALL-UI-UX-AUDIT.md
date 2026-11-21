# Heimdall UI/UX Audit — Initial Source Review

**Baseline:** `main` at `f7ba8c42f171d02fd0f5843cd464cafb8820e0f2`  
**Scope reviewed:** App Router route tree (all page/layout/API route paths), root layout and global CSS, dashboard, landing/login, guild configuration, member list/profile, recruitment, events/event detail, statistics, rankings, resource/reservation surfaces, bidding, calls, users and platform-admin entry points.  
**Method:** Source-level implementation review. This is an initial audit, not a claim of completed cross-device browser testing. Runtime visual inspection and interaction QA remain required during implementation.

## Executive assessment

Heimdall already has broad operational functionality, but the UI has evolved feature-by-feature rather than from a shared product system. The dominant issues are inconsistent information architecture, repeated page-specific styling, dense operational views without a common interaction grammar, and desktop-first data layouts. The safest redesign is an incremental frontend refactor that preserves routes, API contracts, permissions, business rules and existing data.

## Findings

| Module | Existing Problems | UX Severity | Recommended Improvement | Implementation Priority |
|---|---|---:|---|---:|
| Global shell / navigation | No shared authenticated application shell is evident in the route structure; pages independently render their own headers and back links. Navigation context and page hierarchy can vary by module. | High | Establish one responsive app shell with role-aware primary navigation, clear active states, consistent page headers and contextual secondary navigation. Preserve every existing destination and permission gate. | P0 |
| Design system / global styles | Global CSS contains only a small theme setup plus selector-specific overrides targeting dashboard markup. Most UI styling is embedded in page-level Tailwind strings. | High | Define semantic design tokens and shared primitives for buttons, fields, surfaces, tables, badges, dialogs, feedback and focus states. Remove brittle selector overrides as affected screens are migrated. | P0 |
| Dashboard | Dashboard is a large server component combining data aggregation, activity shaping, time calculations and presentation. The visible design uses several repeated card/activity patterns. Date calculations use a fixed Asia/Bangkok timezone. | High | Separate data composition from presentation; establish prioritized “today / next actions / activity” hierarchy; use configured guild/user timezone consistently where available; reduce repeated card chrome. | P1 |
| Public landing / pricing / login | Public landing content exists in more than one implementation path, creating potential content and visual drift. Login is a standalone panel with limited contextual navigation. | Medium | Consolidate public entry presentation and establish consistent brand, typography, CTA hierarchy and accessible auth feedback. | P2 |
| Guild overview / settings | Guild settings, user management, bot setup, notifications and ownership transfer are distributed across separate surfaces. The page is primarily a grid of cards followed by a separate form. | Medium | Group settings by task and frequency; make configuration status and next steps visible; preserve ownership and permission controls. | P1 |
| Member management | Member client is a large component with many display fields and a wide table (minimum 900px), filters, field picker, import and edit workflows. Role-dependent filtering is explained in a notice rather than integrated into controls. | High | Create a responsive member directory with compact identity column, saved views/field preferences, clear filters, row-level profile navigation and mobile card/list treatment. Keep advanced stats available through progressive disclosure. | P1 |
| Member profiles | Profile page has distinct permission-dependent presentations and a separate client component for the full profile. | Medium | Standardize profile header, identity/status, section navigation and restricted-data messaging; ensure the same information hierarchy across member and staff views. | P1 |
| Recruitment / applications | Applications have a dedicated client workflow, but the source review indicates another independent page-specific visual system. | Medium | Standardize application queue, status filters, applicant detail and decision actions; clarify irreversible decisions and feedback. | P2 |
| Events list / event types | Event list and event-type management are separate client components. Configuration and operational event discovery risk competing for attention. | High | Make the event list the primary workspace; move configuration into a contextual management area; standardize schedule, timezone, status and empty states. | P1 |
| Event detail / attendance / roster / results | Event detail composes multiple specialized panels (attendance, roster controls, raids, resource links, overrides and result upload). This is functionally rich but can become a long, fragmented page. | High | Use a consistent event workspace with summary, tabs/sections and a clear event lifecycle; keep attendance and roster actions close together; preserve Discord sync, lock timing, snapshots and result archive behavior. | P1 |
| Roster management | Roster controls are embedded in event-specific workflows and include specialized party/role operations. | High | Improve roster scanability, party grouping, assignment feedback and mobile read-only layouts; do not change generation rules or member eligibility. | P1 |
| Statistics / rankings | Statistics and rankings are separate views; job breakdown is modal-based and score availability differs by game. | Medium | Use a consistent analytics layout with clear game-specific score availability, sortable tables and profile links; never apply ROOC scoring formulas to RO3. | P2 |
| Resources / opt-ins / reservations / history | ROOC and RO3 use distinct resource clients; reservations support bulk entry but render member rows in a fixed multi-column layout. Resource workflows are spread across multiple routes. | High | Unify navigation and shared resource primitives while retaining game-specific workflows; make bulk entry responsive and show limits/remaining capacity contextually. | P1 |
| Allocation / bidding / audit / history | Allocation and bid-page experiences are separate operational screens with dense data. The route tree includes audit, correction, backfill and reset operations. | High | Establish a consistent operational table pattern, clear run context, visible status and safe confirmation for destructive actions. Preserve allocation engine behavior and audit trail. | P1 |
| Call To Arms | Call list and detail are separate workflows; the create dialog uses a fixed UTC+7 server-time convention and custom modal implementation. | Medium | Standardize dialog behavior and make timezone explicit and consistent with the app's timezone model. Keep party requirement logic and Discord announcements unchanged. | P2 |
| Users / permissions | User administration has its own role hierarchy and inline explanatory comments; role boundaries are important and differ from operational permissions. | High | Present role capabilities in a concise matrix or contextual help; make assignable roles explicit; preserve server-side permission enforcement. | P1 |
| Notifications | A global notification watcher exists, while guild notification configuration is another surface. | Medium | Standardize notification preferences, unread states, toasts and delivery status; avoid duplicate or ambiguous feedback. | P2 |
| Platform administration | Separate platform-admin routes exist for affiliates and guild creators, distinct from guild-level administration. | Medium | Visually distinguish platform scope from guild scope and keep platform controls inaccessible to ordinary guild roles. | P2 |
| Responsive / accessibility | Wide tables and fixed multi-column form layouts appear in key workflows. Focus, keyboard, reduced-motion and screen-reader behavior is not centralized in a shared component layer. | High | Establish responsive table patterns, mobile-specific actions, visible focus, semantic dialogs, labels, keyboard support and WCAG 2.2 AA checks. | P0 |
| Loading / empty / error / success states | Feedback is implemented locally with different patterns (inline messages, modal alerts, empty panels and loading text). | Medium | Standardize status banners, toasts, skeletons, empty states and field-level errors. | P1 |

## Information architecture proposal

Preserve all existing routes and capabilities, but organize navigation into task-based groups:

1. **Overview** — Dashboard, guild summary and recent activity.
2. **People** — Members, recruitment/applications, users & roles, leave/availability.
3. **Operations** — Events, event results, rosters, Call To Arms.
4. **Resources** — Resource inventory, reservations, opt-ins, bidding/allocation, audit/history.
5. **Insights** — Statistics, rankings and player analytics.
6. **Guild settings** — Guild profile, Discord integrations, notifications, ownership and access.
7. **Platform administration** — Separate, permission-gated area for platform operators.

Navigation visibility must continue to follow existing permissions and module entitlements. A route must not become inaccessible merely because its navigation label moves.

## Initial design direction

- **Character:** restrained dark-neutral operations interface; one clear accent; semantic success/warning/danger colors; minimal decoration.
- **Hierarchy:** compact page titles, explicit section headings, strong table headers and consistent metadata treatment.
- **Density:** operationally useful density on desktop; deliberate mobile layouts rather than horizontal shrinkage.
- **Components:** centralized tokens and primitives; consistent button sizes/variants, inputs, selectors, tables, badges, dialogs, alerts and empty/loading states.
- **Accessibility:** keyboard-first interaction, visible focus, semantic headings/labels, dialog focus management, adequate contrast and reduced-motion support.
- **Consistency:** no backend, schema, scoring, permission or business-rule changes as part of the visual refactor.

## Delivery phases

- **Phase 1 — Audit and foundation:** document findings; establish design tokens and shared primitives.
- **Phase 2 — App shell and navigation:** responsive shell and permission-aware navigation.
- **Phase 3 — Core people workflows:** dashboard, member directory, member profile, recruitment and users.
- **Phase 4 — Operations:** events, event detail, attendance, rosters, results and Call To Arms.
- **Phase 5 — Resources and analytics:** resources, opt-ins, reservations, allocation, bidding, statistics and rankings.
- **Phase 6 — Settings and public surfaces:** guild settings, notifications, platform admin, landing, pricing and login.
- **Phase 7 — QA:** build, lint, route/permission regression, responsive and accessibility checks.

## Known follow-up verification

- Inspect every route at desktop, tablet and mobile breakpoints in a running browser.
- Exercise member, officer, manager, admin and platform-admin permission paths.
- Verify all existing game-specific workflows (ROOC and RO3).
- Verify timezone behavior against configured user/guild settings.
- Test all loading, empty, error, success and destructive-confirmation states.
- Confirm no API, database, scoring, allocation or Discord integration behavior changes.
