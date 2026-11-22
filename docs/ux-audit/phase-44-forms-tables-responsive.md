# Phase 44 — Forms, Tables and Responsive Consistency

**Date:** 22 November 2026  
**Base:** `main` at `8b7b617676b033b71ee81bacc9c6aa3c3940a1c0`  
**Branch:** `ux/phase-44-forms-tables-responsive`

## Scope

A focused source-level consistency pass across representative high-use management workflows: member directory, event creation, recruitment queue, guild user access and resource reservations. This is an incremental pass, not a claim that every route has received browser-level responsive QA.

## Audit findings

| Area | Finding | Decision |
|---|---|---|
| Event creation | Inputs/selects used bespoke Tailwind styling while the shared `hmdl-field` and `hmdl-label` primitives already exist. | Migrate the event creation controls to shared primitives; preserve the event form's established visual sizing through the existing event workspace CSS. |
| Resource reservations | Single-entry and bulk-entry forms used several different control styles and heights. | Standardize selects, quantity inputs and form actions on shared field/button classes. |
| Bulk reservations | Member rows used fixed `1fr 140px 90px` columns. At phone widths this leaves too little room for member identity and can compress the status column. | Use flexible desktop columns and a deliberate two-column mobile layout, with status on its own row. |
| Reservation table | Table used a one-off overflow wrapper and custom table styling rather than the shared table primitives. | Use `hmdl-table-wrap` and `hmdl-table`; retain horizontal scrolling because the table contains multiple operational columns. |
| Member directory | Dynamic stat columns can make the table very wide. | Keep intentional horizontal scrolling; converting this data-dense comparison table to stacked cards would reduce scanability and make numeric comparisons harder. Follow-up: review sticky identity/actions and filter control consistency separately. |
| Recruitment and guild users | These workflows already use the shared `hmdl-field` and `hmdl-btn` patterns in their main filter/action areas. | No unnecessary changes. |
| Global table pattern | The existing shared table wrapper supports horizontal scrolling and sticky headers. | Reuse it where applicable instead of introducing a second table system. |

## Implemented

- Standardized event creation labels, selects and date input on `hmdl-label` / `hmdl-field`.
- Standardized reservation single-entry selects and quantity input on `hmdl-field`.
- Standardized reservation toolbar and form actions on shared button variants.
- Reworked bulk reservation rows to use flexible desktop columns and a compact mobile layout.
- Added an accessible label to each bulk quantity input, tied to its member.
- Migrated the reservations table to the shared `hmdl-table-wrap` / `hmdl-table` pattern.
- Added scoped responsive CSS for the reservation bulk editor; no global layout behavior was changed.

## Explicitly unchanged

- Reservation API requests, save/delete behavior, quantity rules and resource calculations.
- Event creation behavior, event type selection, timezone configuration and schedule rules.
- Member data, filtering/sorting logic, table columns and field preferences.
- Recruitment decisions, guild roles, permissions and authorization.
- Database schema, migrations, routes and scoring/resource allocation logic.

## Validation status

- Source inspection and targeted static changes: completed.
- Build, lint/type checks and Vercel preview: pending CI.
- Browser QA at desktop, tablet and phone widths: pending.
- No merge or production deployment performed.

## Next audit targets

1. Member directory filter toolbar, table identity/actions and edit modal on small screens.
2. Event list cards and event detail/roster workspaces at tablet and phone widths.
3. Resource overview, opt-ins and allocation/bidding table patterns.
4. Form error/help/required-field consistency and destructive-action confirmation patterns.
