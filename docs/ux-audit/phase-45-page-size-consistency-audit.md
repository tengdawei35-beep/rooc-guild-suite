# Phase 45 — Application-wide page sizing and layout consistency audit

**Base commit:** `cfd9a1444b49c04faea473b92f373c41a8d961b2`  
**Scope:** All 37 App Router page routes, shared application shell, global layout primitives, and the route-level client workspaces that define their own page containers.  
**Method:** Static source/CSS audit plus review of the five supplied 1902–1904px desktop screenshots. This is not a live browser or responsive-device test.

## Follow-up status — 27 November 2026

This is a historical page-sizing audit snapshot. The follow-up implementation was merged in PR #106 (`UX: standardize workspace sizing and event/member workflows`). Current `main` contains shared standard/wide/narrow page geometry, normalized gutters and page-header patterns across the principal management workspaces, and fixes for nested wrappers and state-branch drift identified in that implementation. The original route-by-route observations below should not be treated as an unverified current diff. Desktop/tablet/mobile browser screenshot QA remains pending; source-level implementation does not prove responsive correctness.

## Executive summary

The screenshots expose a real system-level inconsistency, not just isolated spacing differences. Pages inside the same management shell use different content widths, horizontal gutters, vertical offsets, heading scales, and sometimes a second nested max-width container. The shared `.hmdl-page` primitive exists, but it is not consistently used as the sole owner of page geometry.

At the supplied desktop viewport, the most visible examples are:

- **Guild Members:** broad directory workspace with a wide table and a relatively compact top gutter.
- **Applicants:** larger left/right inset and a different header/metric rhythm, using a separate recruitment-specific layout system.
- **Guild users:** a different header offset and page width/vertical rhythm from the directory.
- **Leave History:** noticeably narrower and more centered than the primary directory pages.
- **Call To Arms:** content is narrowed again inside the route wrapper by a second `max-w-6xl` container in `CallsClient`.

The application therefore needs one shared page geometry contract with a small number of intentional width variants—not one arbitrary width forced onto every workflow.

## Root causes

1. **Conflicting width authorities.** The base `.hmdl-page` is full-width, while route JSX frequently adds Tailwind `max-w-*` classes. Some feature CSS then overrides the same element with a different `max-width`. Examples include `max-w-4xl`, `max-w-5xl`, `max-w-6xl`, `max-w-7xl`, and feature-specific 76rem/96rem values.
2. **Nested containers.** Some routes wrap a client workspace in `.hmdl-page`, while the client component creates another `.hmdl-page` or `mx-auto max-w-*` wrapper. This compounds horizontal insets and makes the effective width route-dependent.
3. **Inconsistent page gutters.** Pages mix `px-4 py-6`, `px-6 py-8`, `px-6 py-10`, `p-6`, CSS clamp padding, and no explicit padding (relying on the base class).
4. **Feature-specific typography.** Page titles mix Tailwind `text-3xl`, the shared `.hmdl-page-title`, and feature CSS selectors with different clamp ranges/weights. Header eyebrow, title and subtitle spacing also vary.
5. **Legacy and newer layout systems coexist.** Recruitment, member home, member portal, and selected operations pages have bespoke CSS rather than consistently using shared page/header primitives.
6. **State branches drift.** Loading, no-guild, access-denied, empty and populated states sometimes use different wrappers, so the same route can change width and spacing depending on state.

## Recommended layout contract

Adopt the following as the single source of truth for authenticated workspaces:

| Variant | Intended use | Geometry |
|---|---|---|
| `standard` | Most management pages, settings, recruitment, leave, users, event detail | Shared max width of 96rem; consistent responsive page gutter and top/bottom spacing |
| `wide` | Member directory, rankings, statistics, event results, dense resource/allocation tables | Shared max width of 100% up to a 100rem cap; same gutter as standard |
| `narrow` | Single-purpose forms and profile/edit workflows | Shared max width of 64rem; same gutter and vertical rhythm |
| `full` | Rare operational canvases that genuinely need viewport width | No max width, but still use shared gutters |

These are semantic variants, not page-specific pixel values. A page should declare exactly one variant. Its route wrapper owns width and padding; nested client components must not introduce another page-level max-width or page gutter.

### Shared page header

Create/reuse one header pattern with:
- consistent eyebrow-to-title-to-description hierarchy;
- shared title size/weight/line-height and predictable spacing;
- actions aligned to the title block at desktop and stacked/wrapped on narrow screens;
- optional contextual breadcrumb only on genuine detail/child routes;
- consistent top offset regardless of whether the page has a toolbar, metrics, tabs or empty state.

### Shared content rhythm

- Standardize section spacing, metric-card heights/padding, panel padding and toolbar spacing.
- Keep dense data tables wide and horizontally scrollable where necessary; do not shrink the whole page to fit them.
- Ensure filter bars and action rows wrap without changing the page's outer width.
- Preserve feature-specific information architecture and density where justified, but make outer geometry and typography consistent.
- Keep public/auth/billing and member portal shells separate from authenticated management geometry while using the same design tokens.

## Route-by-route audit

Legend: **P0** = directly causes obvious cross-page size drift; **P1** = significant inconsistency; **P2** = intentional separate shell but needs token alignment; **Review** = page delegates most geometry to a client component and requires a focused component-level pass.

| Route | Current source pattern / observation | Priority | Recommendation |
|---|---|---:|---|
| `/admin` | `max-w-6xl px-6 py-10`; bespoke platform-admin shell | P1 | Move to standard management container and shared header; preserve platform-admin information hierarchy. |
| `/admin/affiliates` | Wrapper only; geometry delegated to `AffiliatesClient` | Review | Audit client root for nested max-width/gutters; use standard or wide variant once confirmed. |
| `/admin/guild-creators` | `max-w-6xl px-6 py-10`; custom header spacing | P1 | Align with platform-admin standard header/container. |
| `/allocation` | `max-w-7xl`, `px-4/6`, `py-6/8`; bespoke controls and metric cards | P1 | Use wide variant; remove duplicate width/padding declarations and standardize header/section rhythm. |
| `/allocation/audit` | Same allocation wrapper but independently composed content | P1 | Reuse allocation page shell and header contract; keep audit table wide. |
| `/allocation/history` | `max-w-7xl px-6 py-10`; multiple state branches | P1 | Use wide variant and identical wrapper for loading/empty/populated states. |
| `/allocation/[runId]/bids` | State branches mix no-shell `max-w-7xl` and `.hmdl-page` wrappers | P0 | Normalize every state branch to the same wide container; remove nested max-width. |
| `/apply/[token]` | Public applicant flow; `max-w-xl` card with inconsistent wrapper between states | P2 | Keep narrow public form shell; make all states share identical centered card geometry. |
| `/bid-pages` | Member-facing route with state branches; `max-w-7xl px-6 py-10`, some branches omit shared shell class | P1 | Align all states to one member-portal container and page header. |
| `/billing/new` | Public/billing shell; `max-w-5xl`, separate vertical padding | P2 | Keep dedicated billing width but use shared spacing/type tokens and consistent state geometry. |
| `/billing/success` | Centered `max-w-lg` confirmation card | P2 | Intentional focused confirmation layout; align card spacing and typography tokens. |
| `/events` | Page composition is split between route and `EventsClient`; nested `max-w-7xl px-6 py-10` | P0 | Make route/client agree on one owner; use wide variant and remove duplicate outer gutters. |
| `/events/[eventId]` | Geometry delegated to `EventClient` | Review | Inspect client root and all loading/error/loaded states; standardize to wide detail workspace. |
| `/events/results` | Uses `.hmdl-page` and shared page title, but wrapper sizing differs from sibling event route | P1 | Use same wide container/header as Events and event detail. |
| `/guild` | Settings workspace uses `max-w-4xl px-6 py-10`; multiple state branches | P1 | Use standard/narrow semantic variant consistently across all states. |
| `/guild/applicants` | Recruitment-specific CSS; base `.hmdl-page` has no explicit route-level width/gutter | P0 | Bring recruitment outer geometry and header into shared standard contract; keep its metrics/queue components. |
| `/guild/calls` | Route wrapper uses `.hmdl-page`; `CallsClient` adds `px-4 py-6` and nested `max-w-6xl` | P0 | Remove nested container; route owns wide geometry. Align call header and empty state to shared header/panel patterns. |
| `/guild/calls/[id]` | Delegates to `CallDetailClient` inside a page wrapper | Review | Ensure client does not create another outer container; use same width as Call To Arms list. |
| `/guild/members` | Directory client uses `max-w-7xl px-6 py-8`; table intentionally wide | P0 | Use wide variant; align header, metrics, filters, field chooser and table gutters. Preserve horizontal table scrolling. |
| `/guild/members/[memberId]` | `max-w-4xl p-6`; bespoke profile layout | P1 | Use narrow variant and shared header/back-link treatment. |
| `/guild/members/leave` | `max-w-xl px-6 py-10`; member-facing single-purpose form | P2 | Keep narrow member form, but use the shared narrow page primitive and common title scale. |
| `/guild/members/leave/history` | `max-w-7xl px-6 py-10` in JSX, overridden by feature CSS to 76rem | P0 | Remove conflicting width authority; choose standard or wide based on table needs. Match directory outer alignment. |
| `/guild/members/ocr` | Nested `.hmdl-page` plus `max-w-5xl px-6 py-10` | P0 | Collapse to one narrow/standard page container and use shared header. |
| `/guild/notifications` | `max-w-4xl px-6 py-10`; settings-specific feature styles | P1 | Use standard/narrow settings variant and consistent header/form rhythm. |
| `/guild/rankings` | `max-w-7xl px-6 py-10`; insights workspace | P1 | Use wide variant and shared metric/table spacing. |
| `/guild/reservations` | `max-w-7xl px-6 py-10`; multiple state branches | P1 | Use wide variant and consistent state wrapper; align forms and tables with allocation/resources. |
| `/guild/resources` | `max-w-7xl px-6 py-10`; multiple ROOC/RO3/state branches | P1 | Use wide variant; ensure all resource modes share header, page width and section rhythm. |
| `/guild/resources/history` | Thin page wrapper; `ResourceHistoryClient` owns content | Review | Audit client root; use same wide variant as resource overview and reservations. |
| `/guild/resources/opt-ins` | `max-w-5xl px-6 py-10`; member-facing opt-in flow | P1 | Keep a member workflow width, but declare narrow/standard member variant and align with other member pages. |
| `/guild/select` | Centered `max-w-md` access card | P2 | Intentional standalone access shell; align card sizing with login/switch. |
| `/guild/statistics` | Thin wrapper; `GuildStatisticsClient` owns content | Review | Audit client root and use wide insights geometry consistent with Rankings. |
| `/guild/switch` | Centered `max-w-lg` access card | P2 | Intentional standalone access shell; align with Select Guild and login. |
| `/guild/users` | User-access client owns content; route has separate page structure | P0 | Standardize outer container/header and row/card density with member directory. |
| `/` (member home) | Legacy `.hmdl-member-page` fixed 1120px max width and independent padding | P1 | Keep member portal shell but align its page gutter and heading tokens with member portal pages. |
| `/landing` | Public landing shell `max-w-6xl`, responsive hero and cards | P2 | Keep distinct marketing layout; no need to force management geometry. |
| `/login` | Centered `max-w-md` auth card | P2 | Keep dedicated auth shell; align shared card dimensions with Guild Select/Switch. |
| `/pricing` | Public pricing shell `max-w-6xl`; pricing-specific centered sections | P2 | Keep distinct marketing/pricing layout; align typography and spacing tokens only. |

## Cross-cutting findings

| Component / system | Finding | Priority | Action |
|---|---|---:|---|
| `src/app/globals.css` `.hmdl-page` | Base width/padding exists, but management max width is 96rem and individual routes override it with Tailwind or feature CSS. | P0 | Make semantic width variants explicit and remove route-specific geometry overrides. |
| `src/app/AppShell.tsx` / `.hmdl-shell-content` | Shell provides min-height/min-width but no single content inset contract. | P1 | Define how page gutter is applied once, below the sidebar, across desktop/mobile. |
| Page headers | Mix of `.hmdl-page-title`, Tailwind `text-3xl`, and feature CSS heading selectors. | P0 | Standardize page-header component/classes, including eyebrow, title, description and action alignment. |
| State branches | Some access/empty/loading branches use different outer containers. | P0 | Require the same page-shell component for every state of a route. |
| Nested client roots | Calls, events, OCR and other client workspaces can add a second container. | P0 | Route owns outer page width/gutter; client owns only workflow content. |
| Tables | Directory and history views have different table typography/row rhythm. | P1 | Standardize shared table density variants while retaining horizontal scrolling for genuinely wide data. |
| Metrics/cards | Metric card padding and number scales vary between recruitment, leave, access and other dashboards. | P1 | Provide compact/standard metric primitives with fixed typography and spacing tokens. |
| Member portal | Member home and opt-in pages have separate width logic from management. | P1 | Establish a coherent member-portal geometry without making it identical to admin/management. |

## Implementation sequence

1. **P0 — Establish geometry primitives:** semantic `standard`, `wide`, `narrow`, and `full` variants; one page gutter owner; one page-header pattern.
2. **P0 — Fix the supplied screenshot routes first:** Members, Applicants, Guild Users, Leave History, and Call To Arms. These are the clearest visible inconsistencies and establish the shared patterns.
3. **P0 — Remove duplicate wrappers and state drift:** Events, OCR, allocation bids, event detail, calls detail, and all alternate loading/empty/error branches.
4. **P1 — Migrate all remaining management routes:** rankings/statistics, reservations/resources, settings, admin and billing-adjacent pages.
5. **P1 — Align member portal geometry:** member home, opt-ins, member profile, leave form.
6. **P2 — Keep public/auth experiences intentionally distinct:** landing, pricing, login, guild select/switch, applicant apply and billing confirmation; reuse design tokens, not management widths.
7. **Validation:** capture desktop (1440px and 1920px), tablet (768px/900px), and mobile (390px) screenshots for every route/state; test horizontal table overflow, action wrapping, sticky shell behavior, and no nested horizontal scrollbars.

## Guardrails

- No API, database, role, permission, route, event, allocation, reservation, timezone, or scoring changes are needed for this work.
- Do not force dense tables into narrow cards if that harms comparison.
- Do not make every page the same width: use the four semantic variants above.
- Keep public/auth and member portal information architecture distinct.
- Do not merge or deploy the implementation without explicit approval.
- This audit is static-source based. Browser-level visual and interaction QA remains required before calling the redesign complete.
