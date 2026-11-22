# Heimdall UX Audit — Operational Workflow Second Pass

**Branch:** `feature/comprehensive-ux-audit`  
**Review type:** Source-level workflow and scalability review  
**Status:** Findings verified in source; implementation and browser validation pending

## Scope

This pass follows the first implementation tranche and reviews the allocation preview/run flow, bid-page navigation, allocation history, member management and platform user administration. Findings below are limited to behavior directly visible in the current branch source. They are not claims of browser-tested usability.

## Verified findings

| ID | Severity | Area | Evidence in source | User impact | Recommendation |
|---|---|---|---|---|---|
| HISTORY-02 | High | Allocation history | `src/app/allocation/history/page.tsx` calls `allocationRun.findMany` for the guild without `take`, `skip` or a cursor. Each run includes resource results, every member allocation result, member/resource relations and bid-page metadata. The page then builds cumulative member totals in the client by iterating all returned runs and allocation rows. | History payload, server query work, client memory and render cost grow with every allocation run and every allocation row. This is especially material because the page is a long-lived historical ledger. | Introduce stable cursor pagination for run details and calculate cumulative member totals independently with database aggregation across the full guild history. Preserve exact all-time totals; do not calculate them from only the visible page. Add explicit total/continuation context and a clear empty state. |
| ADMIN-UX-01 | Medium | Platform user directory on narrow screens | `src/app/admin/users/AdminUsersClient.tsx` renders a table with `min-w-[1050px]` inside an `overflow-x-auto` wrapper. The directory does not provide a mobile card/list alternative in this component. | On phones and narrow tablets, users must horizontally pan a wide table to compare account and guild information; important actions/details may be off-screen. | Keep the full comparison table on desktop, but provide a compact responsive user-card/list presentation at narrow breakpoints. Retain the same affiliation counts, account details and View as this user action, with a clear Details disclosure. |
| MEMBER-UX-01 | Medium | Member directory configuration | `src/app/guild/members/MembersClient.tsx` exposes a large set of displayable fields spanning identity, combat, target/equipment and RO3 statistics. The defaults are identity/guild fields, but the available configuration remains a long flat field inventory. | Managers configuring a routine roster view must scan many game-specific metrics even when they only need a task-specific subset. | Group the field chooser into collapsible categories and provide named presets for routine roster, combat review and profile/stat review. Preserve custom selection and persisted preferences. |

## Areas reviewed with no new source finding in this pass

- **Bid-page type selector and pagination:** the current component exposes `aria-pressed` on Feather/Card selectors and `aria-current="page"` plus explicit accessible names on page controls. Search results identify the member, resource, type, page and slot.
- **Allocation preview/run:** required event and explicit non-reserved member count validation are present; view-only users receive a disabled run action with explanatory copy; the run action confirms the permanent operation and reports pending/success/error states.
- **Reservation controls:** view-only mutation controls are hidden; deletes are serialized with row-specific progress feedback; bulk reservation partial successes are retained for safe retry.
- **Platform user data:** the directory uses server-provided pagination and aggregate counts; account details are disclosed on demand rather than expanded for every user.

## Recommended implementation order

1. **HISTORY-02:** bound allocation-history detail queries while preserving all-time cumulative totals through a separate database aggregate.
2. **ADMIN-UX-01:** add a narrow-screen presentation for the platform user directory without reducing desktop comparison capability.
3. **MEMBER-UX-01:** add categorized, task-oriented field presets while preserving custom columns and existing local preferences.

## Validation required before merge or production

- TypeScript, lint, production build and the existing CI workflow.
- Verify allocation history page boundaries, stable ordering, no duplicate/missing runs, and cumulative totals against the unpaginated baseline for a test guild.
- Verify member/resource names and totals when a member or resource has historical records across many runs.
- Test platform user directory at phone, tablet and desktop widths, including users with zero, one and many guild affiliations.
- Test member field presets, custom selections, persistence, game-type differences and role-based stat redaction.
- Keyboard and screen-reader checks for disclosures, pagination and responsive table/card alternatives.

No production merge or deployment is authorized by this audit pass.
