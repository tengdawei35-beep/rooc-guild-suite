# Phase 46 — application-wide page sizing implementation

**Base:** `cfd9a1444b49c04faea473b92f373c41a8d961b2`  
**Branch:** `ux/phase-46-global-page-sizing`  
**Scope:** Shared page geometry, page-header hierarchy and legacy nested workspace containers. Presentation-only changes.

## Implemented

### Shared geometry contract
- Added standard (96rem), wide (100rem), and narrow (64rem) semantic maximum-width tokens.
- Standardized authenticated management page gutters and vertical spacing through one shared page-container rule.
- Kept standard as the default; wide is applied to directory, insights, event, results, resource, reservation, allocation, history, bid and Call To Arms workspaces.
- Narrow variants are retained for guild settings/configuration and member profile workflows.
- Added matching platform-admin and affiliate container rules.
- Added mobile gutter and header-action wrapping rules.

### Duplicate container cleanup
- Removed the route-level wrapper around Applicants so the client workspace owns its page container exactly once.
- Removed the nested max-width and second page padding from Call To Arms. The route-owned page wrapper now controls the width and gutters, and the client owns only workflow content.
- Added a safe nested-container rule for legacy client workspaces rendered inside route-owned pages (including insights and resource history), preventing a second max-width or horizontal inset.

### Page heading consistency
- Normalized the page-level heading scale, weight, tracking and line height for shared page headers.
- Extended the same heading treatment to legacy nested workspace headers and Call To Arms.

## Route coverage

The shared rules cover all authenticated management routes that use `.hmdl-page`, plus legacy workspace families that still use direct `.mx-auto` wrappers. The public marketing, auth, applicant, billing and member portal shells remain distinct by design, but continue to use their own intentional content widths.

The implementation is intended to align the five supplied examples:
- Guild Members — wide
- Applicants — standard
- Guild Users — standard
- Leave History — standard
- Call To Arms — wide

The same geometry contract also covers platform administration, allocation and bidding, events and results, rankings/statistics, resource management, reservations, guild settings, member profiles, and nested history workspaces.

## Preserved behavior

- No API, database, auth, permission, route, event, recruitment, allocation, reservation, timezone, billing or Discord behavior changed.
- No scoring weights or game calculations changed.
- No table columns, data, filtering, or business workflows were changed.
- No public/auth/member portal information architecture was merged into the management shell.

## Validation status

- Static source review completed for the five screenshot routes and legacy container patterns identified in the 37-route audit.
- Source checks confirmed Applicants has one page owner and Call To Arms no longer introduces its own max-width container.
- Browser visual QA, responsive viewport screenshots, and CI/build checks are pending PR validation.
- Required browser matrix before production: 1920px, 1440px, 900px, 768px, and 390px across all routes, including loading/empty/error/populated states.

## Follow-up UX pass — event results and roster workflows

- Event Results archive now exposes loading and error states to assistive technology, provides a retry action, and aborts an in-flight request when the view unmounts or retries.
- Results groups now have explicit accessible headings; screenshot links have descriptive new-tab labels, visible keyboard focus, and lazy-loaded previews.
- Removed a redundant max-width constraint from the archive route so the shared page geometry remains the single width owner.
- Event screenshot upload progress now uses native progressbar semantics with accessible min/max/current values.
- Existing upload, storage, OCR, event association and permission behavior remains unchanged.
- Browser interaction checks remain a manual preview task; automated CI and Vercel preview checks are tracked on the PR.

### Roster interaction refinement

- Dragging is now initiated from a dedicated, focusable slot-number handle instead of the entire member row. This prevents the native drag target from competing with the Move to selector, job override control, or Remove action.
- The Move to selector remains the keyboard-friendly alternative to drag-and-drop.
- Removing a member now requires confirmation and is disabled while that member is being moved or removed.
- Roster membership API behavior and move/swap rules are unchanged.
