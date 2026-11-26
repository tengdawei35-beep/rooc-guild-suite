# Phase 43 — Heimdall Application UX Audit

**Audit date:** 22 November 2026  
**Repository:** `tengdawei35-beep/rooc-guild-suite`  
**Audited ref:** `main` at `bfd2290c1bd7bbfbde4e433e06aeafba3ccbcf86`  
**Scope:** Static repository audit of the Next.js App Router, route inventory, shared application shell, design foundation, representative page implementations, API surface, and available quality tooling.

## Follow-up status — 27 November 2026

This file is a historical static audit snapshot, not a current implementation checklist. Since the audited commit:

- CI now runs TypeScript, ESLint, production build, and the RO3 simulator/composition test suite.
- The platform administration workspace has expanded. All nine current `/admin` page routes are server-guarded with `getPlatformAdmin()`; sensitive admin APIs are separately protected.
- `/guild/statistics` now has a page-level authentication and `members.view` permission guard.
- `/guild/resources/history` was the remaining page wrapper without a page-level guard; this follow-up adds `requirePageAuth()` and the `allocation.view` permission check. Its API already enforced both authentication and permission.
- The full route-by-route API security review and live responsive/accessibility browser QA remain separate validation tasks. The original route/API counts below describe only the 22 November snapshot.

## Executive summary

The application has a recognisable product structure and a meaningful first-pass design foundation. The codebase separates member and management navigation, uses role permissions to construct management navigation, has semantic HMDL colour/surface/control tokens, provides a responsive shell, and includes 37 page/layout route files and 71 API route handlers.

The redesign is **not yet a fully audited or validated product experience**. The main outstanding risks are inconsistent migration to shared components/tokens, uneven page-level authentication handling, unverified responsive and accessibility behaviour in complex client components, and the absence of an automated test suite in the repository. The 71 API handlers also require a dedicated permission and regression audit; this phase inventories them but does not certify each handler.

This is a static code audit. It does not claim that every screen was visually inspected in a live browser, that every interaction was executed, or that production workflows were functionally tested.

## 1. Repository and application inventory

### Application structure

- Framework: Next.js App Router, React 19, TypeScript.
- Styling: Tailwind CSS 4 plus a large global stylesheet.
- Data layer: Prisma.
- Billing integration: Stripe.
- Game/event integrations include Discord routes, OCR processing, event scheduling and roster management.
- Shared authenticated layout: `src/app/layout.tsx` and `src/app/AppShell.tsx`.
- Shared styling foundation: `src/app/globals.css`.
- Role and permission definitions: `src/lib/permissions.ts`.
- Session and page/API authentication helpers: `src/lib/auth.ts`.

### Route counts

| Area | Page routes |
|---|---:|
| Guild management and member experience | 19 |
| Events and event results | 3 |
| Allocation and bidding | 5 |
| Platform administration | 3 |
| Billing and pricing | 3 |
| Public landing, login and root | 3 |
| Applicant access | 1 |
| **Total page routes** | **37** |

The count includes the root layout file. There are **36 `page.tsx` routes**.

### Page route inventory

**Guild and member workspace**
- `/guild`
- `/guild/applicants`
- `/guild/calls`
- `/guild/calls/[id]`
- `/guild/members`
- `/guild/members/[memberId]`
- `/guild/members/leave`
- `/guild/members/leave/history`
- `/guild/members/ocr`
- `/guild/notifications`
- `/guild/rankings`
- `/guild/reservations`
- `/guild/resources`
- `/guild/resources/history`
- `/guild/resources/opt-ins`
- `/guild/select`
- `/guild/statistics`
- `/guild/switch`
- `/guild/users`

**Events**
- `/events`
- `/events/[eventId]`
- `/events/results`

**Allocation and bidding**
- `/allocation`
- `/allocation/audit`
- `/allocation/history`
- `/allocation/[runId]/bids`
- `/bid-pages`

**Platform administration**
- `/admin`
- `/admin/affiliates`
- `/admin/guild-creators`

**Applicant access**
- `/apply/[token]`

**Billing and public pages**
- `/billing/new`
- `/billing/success`
- `/pricing`
- `/landing`
- `/login`
- `/`

### API surface

The repository contains **71 API route handlers**:

| API domain | Handlers |
|---|---:|
| Guild | 25 |
| Events | 18 |
| Authentication | 7 |
| Allocation | 6 |
| Billing | 5 |
| Administration | 3 |
| Notifications | 2 |
| Applicant application | 2 |
| Cron | 2 |
| Discord interactions | 1 |
| **Total** | **71** |

The breadth of the API surface makes a separate route-by-route permission and regression review necessary. API count is an inventory, not a security certification.

## 2. Existing UX and design strengths

### Information architecture and navigation

- `AppShell.tsx` has distinct member and management navigation groups.
- Management navigation is permission-aware for members, recruitment, users, leave, events, rosters, allocation and guild configuration.
- Resource navigation is conditional on the Resource Suite module.
- Platform administration is surfaced separately for platform administrators.
- The shell displays the active guild and the user's role, and supports guild switching when multiple guild memberships are available.
- The mobile shell has a menu control with `aria-expanded` and `aria-controls`; the navigation has an accessible label.
- The latest navigation fixes for Call To Arms and Bid Pages are present in the audited main commit history.

### Design foundation

The global stylesheet defines semantic tokens for:
- Background, surfaces, borders, text hierarchy and accent.
- Success, warning, danger and informational status colours.
- Radius, popover shadow and focus-ring values.
- Shared surface, field, button, badge, table, empty-state and dialog classes.
- Management/member density and control-height differences.
- A small-screen table-card mode and reduced-motion preferences.

A global `:focus-visible` treatment is present. These are good foundations to standardise the remaining modules against.

### Access and privacy foundations

- Roles are defined as Admin, Manager, Officer and Member.
- Permission checks are centralised in `src/lib/permissions.ts`.
- Session authentication is centralised in `src/lib/auth.ts`.
- Member directory data conditionally suppresses other members' character-stat fields for the Member role.
- The member profile route contains a corresponding distinction between the member's own stats and other members' stats.

These controls should be retained during UX refinement; this audit does not recommend changing permission policy.

## 3. Audit findings matrix

Severity definitions: **Critical** = potential security/data integrity or release blocker; **High** = major workflow/accessibility/responsive risk; **Medium** = meaningful inconsistency or friction; **Low** = polish/documentation.

| Module | Existing problem / evidence | Severity | Recommended improvement | Priority |
|---|---|---|---|---|
| Page authentication consistency | Most server-rendered workspace pages call `requirePageAuth()`, but `/guild/resources/history` and `/guild/statistics` are thin wrappers that render client components without a page-level auth guard. Their APIs do enforce authentication/permissions, so this is not evidence of data exposure; it can still render a workspace shell that subsequently shows an API error to an unauthenticated visitor. | Medium | Align page-level auth and permission handling with the rest of the authenticated workspace, while retaining API enforcement. | P1 |
| Design-system adoption | Shared HMDL tokens and components exist, but representative pages still use legacy page-specific colours/surfaces (for example, the resource history client uses hard-coded `#0b0b0b`/gray styling, and member-profile/rankings branches use zinc utility styling). The stylesheet also retains legacy dashboard selectors. | High | Establish a migration inventory; replace legacy styling with semantic tokens and shared components module by module. Avoid a risky all-at-once CSS rewrite. | P1 |
| Navigation and wayfinding | The shell provides a clear primary structure, but contextual return links are not yet consistently modelled. Statistics and rankings still use Dashboard return links, while other areas have module-specific destinations. | Medium | Standardise page titles, breadcrumbs and contextual back destinations. Keep a back link only when it adds a reliable parent destination. | P2 |
| Member directory and profiles | Directory and profile routes have privacy-aware server-side field selection. The directory query currently loads the guild's member records and related leave dates as a complete collection before passing them to the client. | Medium | Review client-side pagination/filtering and payload size for larger guilds; move filtering/pagination server-side if needed. Preserve the current member-stat privacy rules. | P2 |
| Events, schedules and rosters | Event operations span three page routes and 18 event API handlers, including attendance, preferred rosters, raid/roster operations, final rosters, results, and event type/schedule settings. Complexity is high and the route inventory alone cannot verify end-to-end consistency. | High | Test the complete create → configure → attendance → roster → results lifecycle for both game types and configured time zones. Review error, empty, loading and success feedback. | P1 |
| Resource Suite and allocation | Resource operations are distributed across resources, opt-ins, reservations, allocation, bidding, history and audit pages. Feature availability is module- and game-dependent. | High | Test ROOC and RO3 separately, including disabled states, module access, reservation, preview, allocation run, bidding and audit/history. Clearly explain unavailable features and next steps. | P1 |
| Forms and destructive actions | Static page review shows client-heavy workflows and stateful actions; a full audit of every nested client component, validation rule, confirmation, and keyboard interaction has not been completed. | High | Inventory all create/edit/import/delete/reset actions. Standardise field labels, inline validation, pending states, confirmation copy and post-save feedback. | P1 |
| Tables and dense data | Shared table styles and a mobile card mode exist, but page implementations still contain bespoke tables and fixed minimum widths (resource history, for example, uses a 720px minimum table width). | High | Review each data table at mobile widths. Decide deliberately between card transformation, priority columns, horizontal scrolling, or a dedicated mobile view. | P1 |
| Responsive application shell | The shell includes a mobile header/menu and global small-screen rules. The presence of CSS does not establish that every nested page, dropdown, dialog, table or toolbar works at phone/tablet widths. | High | Run a route-by-route viewport pass at desktop, laptop, tablet and mobile sizes; fix overflow, sticky elements, navigation and touch target issues. | P1 |
| Accessibility | Positive foundations include labelled navigation, active-page state, focus-visible styling and reduced-motion support. There is no configured automated accessibility test tooling in the repository, and complex dialogs/client controls have not been verified for focus management, keyboard operation, labels or contrast. | High | Target WCAG 2.2 AA. Audit keyboard-only flows, focus order/return, dialog semantics, accessible names, form errors, contrast, status text and touch targets. Add automated checks where practical. | P1 |
| Loading, empty and error states | Some pages explicitly provide loading, empty and error feedback (e.g. resource history and statistics). Coverage and consistency across all client components have not been established. | Medium | Create shared state patterns and verify every asynchronous page has loading, empty, error, retry and success states where applicable. | P2 |
| Platform administration and billing | Admin, guild creator, affiliate, pricing, checkout and billing-success pages are present. Their full role, entitlement, checkout-failure and responsive workflows were not executed in this static pass. | High | Validate platform-admin access boundaries, subscription/entitlement states, checkout cancellation/failure/success and recovery paths. | P1 |
| Automated quality assurance | `package.json` provides build and lint scripts, but the repository tree contains no test/spec files and no Playwright, Cypress, Jest, Vitest or accessibility-test configuration. | Critical | Add a proportionate automated baseline: type/build/lint in CI, API/service tests for critical rules, and browser smoke tests for the main member and management journeys. | P0 |
| Product documentation | The README remains the default create-next-app starter text and does not describe Heimdall's setup, roles, modules, configuration or operational workflows. | Low | Replace the starter README with concise product/developer setup documentation after the UX and QA baselines are established. | P3 |

## 4. Priority work queue

### P0 — Release confidence baseline
1. Add CI checks for the existing build and lint scripts.
2. Add automated tests for the highest-risk business rules and API permission boundaries.
3. Add browser smoke tests for login/guild selection, member profile privacy, event operations, and allocation/bidding.
4. Record the expected test environment and required environment variables without exposing secrets.

### P1 — Functional and access-critical audit
1. Review authentication and permission handling for every page and API route.
2. Test the full event, attendance, roster and results lifecycle.
3. Test ROOC/RO3 feature gating and Resource Suite workflows.
4. Audit all form and destructive-action states.
5. Run desktop/tablet/mobile responsive checks on all primary modules.
6. Run a keyboard and accessibility audit of navigation, forms, tables and dialogs.
7. Validate billing, platform administration and entitlement recovery.

### P2 — UX consistency and efficiency
1. Complete the shared design-system migration.
2. Standardise breadcrumbs and contextual navigation.
3. Review member directory scalability and data density.
4. Standardise asynchronous loading, empty, error and success patterns.
5. Review search, filters, sorting, bulk actions and repeated management workflows.

### P3 — Documentation and polish
1. Replace starter README content.
2. Finish low-severity visual and copy consistency issues.
3. Document role-specific workflows and module availability.

## 5. Required manual validation matrix

The following must be executed against a working preview; source inspection cannot substitute for these checks.

| Persona / context | Primary journeys to validate |
|---|---|
| Member | Login → guild selection → member home → events/attendance → own profile → leave application → notifications |
| Officer | Member directory/profile → recruitment review → event setup/attendance → roster operations → Call To Arms |
| Manager | All officer workflows plus user/role management, guild settings and resource operations |
| Admin | Guild configuration, ownership transfer, role boundaries, platform admin separation |
| Platform admin | Guild creators, affiliates, billing and subscription/entitlement management |
| ROOC guild | Legacy resource configuration, reservations, allocation, bidding, history and audit |
| RO3 guild | RO3 stats/OCR, event type/schedule/time zone, rosters/results and RO3 resource workflows |
| Small/mobile viewport | Every persona's primary workflows at phone and tablet widths |

For each journey, record: expected result, actual result, viewport, role, game type, severity, reproduction steps and screenshot/evidence.

## 6. Audit limitations and confidence

- **Repository inventory:** completed against the recursive Git tree on the audited commit.
- **Page-level static review:** all 36 page route files were inventoried; representative route implementations, the shared shell, permissions, auth helpers, design foundation and selected APIs were inspected.
- **API security review:** not complete. All 71 API route handlers were counted and grouped, but not each handler's authorization and validation logic reviewed line by line.
- **Client component review:** not complete. There are 36 additional app component files; nested dialogs, forms, tables and state transitions still need focused review.
- **Visual/browser review:** not performed in this phase. No live browser viewport or screenshot evidence was available through the repository inspection.
- **Build/lint/tests:** not run in this phase. No claim is made that the current commit passes these checks.
- **Runtime integrations:** Discord, Stripe, OCR, storage, database and scheduled tasks were not exercised.
- **Data/schema:** no schema or production data changes are proposed by this audit.

## 7. Recommended next phase

**Phase 44 — Design System Completion and Component Inventory**, beginning with the shared component and client-component audit. Before broad visual changes, map every bespoke button, field, dropdown, status badge, table, dialog, toast, loading state and empty state to the intended shared pattern. In parallel, start the P0 test baseline so subsequent module refinements can be verified instead of relying only on manual build confirmation.

No application behaviour, permissions, database schema or business logic was changed in Phase 43.
