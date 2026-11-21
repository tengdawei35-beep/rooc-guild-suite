# Heimdall UI/UX Audit and Product Experience Direction

**Baseline:** `main` at `f7ba8c42f171d02fd0f5843cd464cafb8820e0f2`  
**Status:** Product direction approved for implementation.  
**Method:** Initial source-level review of the App Router, root layout/global CSS, dashboard, guild configuration, member list/profile, recruitment, events/event detail, statistics, rankings, resource/reservation surfaces, bidding, calls, users and platform-admin entry points. This is not a claim of completed browser QA.

## Product principle

> **Management gets the tools to run the guild. Members get the tools to participate in the guild.**

Heimdall is a commercial guild operations SaaS product, not a gaming fan project. It serves two audiences with different jobs to be done. They share one platform, identity system, data model, permission system, APIs and design language, but they must not be forced into the same information architecture or screen density.

### Guild Management workspace

Designed for Admins, Managers and Officers according to their existing permissions:
- High information density where it improves operational speed.
- Strong overview of guild health, today's activity, upcoming events and pending work.
- Advanced filtering, sorting, bulk selection/actions and fast access to administrative tools.
- Clear operational status, auditability, safe destructive actions and efficient desktop workflows.
- Responsive behavior remains usable on tablets and phones; complex tables may use intentional horizontal scrolling or mobile-specific summaries.

### Guild Member portal

Designed for Members:
- Simple, calm, personal home screen with the next relevant action prominent.
- Upcoming events, clear attendance/availability actions and notification visibility.
- Easy access to own profile, statistics, leave/availability and relevant guild information.
- Avoid exposing management-only controls, dense analytics or administrative navigation.
- Mobile-first interaction and concise language.

### Shared platform rules

- Existing server-side authorization and module entitlements remain the source of truth. Navigation visibility is not authorization.
- Do not invent new application roles to support the visual split. Existing roles remain ADMIN, MANAGER, OFFICER and MEMBER.
- Management users may be offered a clearly labelled Member View preview/switch, but this must not alter their permissions or impersonate a member.
- Platform administration remains a separate scope and must not be mixed into guild management navigation.
- Preserve routes, APIs, database schema, event rules, Discord integration, allocation/bidding behavior, scoring, and stored data unless a separate approved feature explicitly changes them.

## Proposed information architecture

### Management workspace
- **Overview:** Dashboard, activity, pending actions.
- **People:** Members, Recruitment, Users & Roles, Leave & Availability.
- **Operations:** Events, Rosters, Results, Call To Arms.
- **Resources:** Resource Overview, Opt-ins, Reservations, Allocation, Bidding, History & Audit.
- **Insights:** Statistics, Rankings.
- **Configuration:** Guild Settings, Discord Integration, Notifications.
- **Platform Admin:** Separate, platform-permission-gated entry point.

### Member portal
- **Home:** Personal overview, next event, outstanding actions and notifications.
- **My Guild:** Events and guild directory.
- **My Activity:** Attendance, availability and leave history.
- **My Profile:** Character profile and statistic submission.
- **Notifications / Account:** Personal notification and account controls.

All existing destinations must remain reachable to users who are authorized for them, even when labels or navigation groupings change.

## Visual and interaction direction

- **Character:** Professional, minimalist SaaS; restrained dark navy/slate surfaces, muted blue accent, semantic status colors and restrained elevation.
- **Typography:** Geist; clear page-title/section/body/metadata hierarchy; readable numeric alignment in operational tables.
- **Spacing:** Consistent spacing scale, deliberate page gutters and predictable component heights.
- **Management density:** Compact controls and tables, strong scan lines, sticky table headers where useful, filter toolbars and bulk-action patterns.
- **Member simplicity:** Fewer choices per screen, prominent primary actions, concise event cards and personal status.
- **Navigation:** Persistent, responsive navigation with clear current location; management and member navigation remain distinct.
- **Feedback:** Consistent loading, empty, success, warning, error and confirmation states.
- **Accessibility:** Keyboard operation, visible focus, semantic controls/dialogs, sufficient contrast, reduced-motion support and responsive text/layout.
- **Brand:** Avoid game-themed ornament, excessive gradients, decorative badges and oversized rounded cards.

## Source review findings and priorities

| Area | Finding | Priority |
|---|---|---:|
| App shell / navigation | No shared authenticated shell is evident; pages independently render headers/back links. | P0 |
| Design system | Styling is mostly page-level Tailwind; global CSS contains brittle dashboard selectors. | P0 |
| Audience separation | Dashboard and navigation do not yet express distinct management/member jobs. | P0 |
| Dashboard | Large server component combines aggregation, time calculations and presentation; date logic includes fixed Asia/Bangkok assumptions. | P1 |
| Member directory | Large client component and wide table; filtering, field selection, import and edit flows need a consistent operations pattern. | P1 |
| Member profiles | Permission-dependent presentations need consistent identity and information hierarchy. | P1 |
| Events / event detail | Specialized attendance, roster, raids, resource and results panels create a long fragmented workflow. | P1 |
| Rosters | Dense party/role assignment needs stronger scanability and responsive read-only views. | P1 |
| Resources / reservations | ROOC and RO3 clients are separate; bulk entry and member rows need responsive patterns. | P1 |
| Allocation / bidding / history | Dense operational screens need consistent tables, run context and safe confirmations. | P1 |
| Guild settings / users | Configuration and role management are distributed; role boundaries must remain unchanged. | P1 |
| Recruitment | Queue, filters, applicant detail and decision feedback need shared patterns. | P2 |
| Statistics / rankings | Separate views; score availability differs by game. Never apply ROOC formulas to RO3. | P2 |
| Calls / notifications | Custom dialogs and local feedback patterns need consistency; timezone handling must not be hardcoded as part of visual work. | P2 |
| Public / platform admin | Public entry points and platform scope need a consistent brand while remaining separate from guild operations. | P2 |
| Responsive / accessibility | Wide tables and fixed layouts need deliberate small-screen and keyboard treatment. | P0 |

## Implementation roadmap

1. **Foundation and shared shell:** semantic tokens, primitives, responsive shell, distinct management/member navigation, permission-aware route visibility.
2. **Management overview:** operational dashboard, action queue and management navigation.
3. **Member portal:** member home, upcoming events, attendance/availability actions, personal navigation.
4. **People:** directory, profiles, recruitment, user administration.
5. **Operations:** events, attendance, rosters, results and Call To Arms.
6. **Resources:** resource views, opt-ins, reservations, allocation, bidding, audit/history.
7. **Insights and configuration:** statistics, rankings, guild settings, notifications and platform admin.
8. **QA and polish:** route/permission regression, responsive and accessibility checks, visual consistency.

Each phase is delivered incrementally. Do not replace the whole application at once.

## Non-negotiable regression boundaries

- No database/schema migrations for a visual redesign.
- No changes to authentication/session semantics or server-side permissions.
- No changes to event attendance states, Discord synchronization, roster generation, event locks, result archives or timezone configuration behavior.
- No changes to allocation engine, bidding rules, resource caps, scoring weights or ROOC/RO3 calculation behavior.
- No destructive data operations.
- Keep platform-admin access distinct from guild roles.
- A navigation item being hidden must never be treated as a security boundary.

## Verification required

- Production build and lint/type checks for each phase.
- Browser QA at desktop, tablet and mobile widths.
- Test Member, Officer, Manager and Admin navigation and direct-route access; test platform-admin separately.
- Verify ROOC and RO3 workflows independently.
- Verify event timezone defaults to the user's computer time with configurable timezone behavior; do not introduce fixed timezone assumptions.
- Exercise loading, empty, error, success, bulk-action and destructive-confirmation states.
- Confirm no API, database, permission, scoring, allocation or Discord behavior changes.
