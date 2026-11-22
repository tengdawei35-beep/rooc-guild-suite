# Heimdall UX Audit — Baseline

**Audit branch:** `feature/comprehensive-ux-audit`  
**Baseline:** `main` at the start of this audit  
**Audit type:** Operational usability and accessibility  
**Status:** Phase 1 source inspection; runtime/browser validation still required

## Scope and evidence standard

This audit distinguishes:
- **Verified (source):** directly observed in the current implementation.
- **Needs runtime verification:** source suggests a risk, but interaction behavior, rendered contrast, responsive behavior, or actual task completion has not been exercised in a browser.
- **Not yet inspected:** module-specific source review remains outstanding.

No production interaction is described as tested unless it has been exercised in the running application. No visual-only redesign is proposed as a substitute for workflow improvements.

## Product structure observed

The application uses Next.js App Router, React 19, Prisma/PostgreSQL, a shared authenticated AppShell, role-aware navigation, and distinct member and management navigation sets. Current top-level navigation groups are Overview, People, Operations, Resources, Insights and Configuration. Platform administration is a separate navigation group. The member portal exposes My Guild and My Activity.

Observed workflows/modules include:
- Guild dashboard and role onboarding.
- Member portal home, guild member directory and individual member profiles.
- Guild users/roles, recruitment applicants, leave applications and leave history.
- Events, event detail, roster/preferred roster views, call-to-arms and event-result archive.
- Resource suite: overview, opt-ins, reservations, allocation, bidding and allocation history.
- Statistics and rankings.
- Guild settings and Discord notifications.
- Platform administration, guild portfolio, user directory and impersonation.

The Prisma schema includes guild memberships, guild members, events, attendance, rosters, leave, resources, allocation, subscriptions, module entitlements and related records. Schema presence alone is not evidence that a workflow is usable.

## Verified findings from source inspection

| ID | Severity | Module / location | Verified problem | User impact | Principle | Recommendation | Complexity | Expected benefit |
|---|---|---|---|---|---|---|---|---|
| NAV-01 | Medium | AppShell navigation; Events/Rosters | Both Events and Rosters point to `/events` with different query strings, but active-state matching discards the query string. On the rosters view, both links can be marked current. | Ambiguous location and misleading navigation state. | Visibility of system status; consistency | Make active-state matching query-aware for view links, or give each view a distinct route/tab state. | Low | Clearer orientation. |
| NAV-02 | Medium | Mobile AppShell navigation | The mobile menu toggles visibility and closes on link selection, but no Escape-key handling, outside-click dismissal, focus movement/return, or explicit menu landmark state is implemented in the inspected component. | Keyboard and assistive-technology users may have difficulty opening, navigating and dismissing the menu. | WCAG 2.2 AA; user control | Implement a keyboard-operable disclosure pattern with focus behavior, Escape dismissal and accurate accessible naming. | Medium | More predictable mobile navigation. |
| NAV-03 | Low | AppShell mobile menu button | The button exposes `aria-expanded` and `aria-controls`, but its accessible name changes only between visible text “Menu” and “Close”; no explicit navigation landmark focus management is present. | Discoverability and orientation can be weaker for screen-reader/keyboard users. | Accessibility; recognition over recall | Use a stable, descriptive accessible label and complete disclosure behavior. | Low | Better assistive-technology clarity. |
| NAV-04 | Medium | AppShell active navigation | Active state is implemented with `aria-current=page` for group links, but the query-view collision means the semantic current-page signal may be applied to multiple links. | Screen readers may announce more than one current page. | WCAG; system status | Ensure exactly one matching navigation item for the active route/view. | Low | Reliable current-location announcement. |
| HOME-01 | Medium | Management dashboard | Dashboard computes “today” using a fixed `Asia/Bangkok` timezone, while guilds have a configurable `timeZone` field and events have `scheduleTimeZone`. | Guilds in other timezones may see incorrect today/availability/event counts or date boundaries. | Match system to real world; error prevention | Use guild-configured timezone consistently, with a documented fallback and clear display of the timezone used. | Medium | More trustworthy operational summaries. |
| PEOPLE-01 | High | Member directory vs leave application | Member directory identifies the current member using either `userId` or `discordUserId`; leave application lookup uses only `userId`. | A Discord-linked member without a populated userId can appear in the directory but cannot submit leave, despite being the same authenticated account. | Error prevention; consistency | Resolve the member using the same account-linking rule used elsewhere, while preserving uniqueness and permission checks. | Low–Medium | Removes a dead-end member workflow. |
| INSIGHT-01 | High | `/guild/statistics` page | The inspected page component renders `GuildStatisticsClient` without calling `requirePageAuth` or a page-level permission check, unlike the rankings page. | The route relies entirely on client/API protection; page-level access boundaries are inconsistent and could expose shell/content behavior before client requests. | Security-adjacent UX; consistency; error prevention | Verify all statistics data APIs enforce guild-scoped authentication and intended permissions; add page-level auth/permission gate consistent with other insights routes. | Medium | Predictable access control and fewer confusing access states. |
| PEOPLE-02 | Medium | Member directory | The page loads every guild member and all leave dates for the guild before passing the dataset to a client component. | Large guilds may experience slower initial load, heavier client payloads and less efficient scanning. | Efficiency; cognitive load | Inspect client-side filtering and actual data volume; introduce server-side pagination/search only if current behavior is measurably costly, preserving existing analytics needs. | Medium–High | Better performance at scale. |
| PEOPLE-03 | Medium | Member directory field configuration | The directory supports a very broad set of ROOC/RO3 fields and persisted display-field selection. This is powerful but creates a large configuration surface. | Users may need to understand many game-specific metrics before finding the few fields needed for routine roster management. | Progressive disclosure; Hick's Law | Provide role/task-oriented presets (e.g. roster, combat, profile) while retaining custom columns. Validate discoverability and persistence. | Medium | Faster scanning with advanced control retained. |
| EVENTS-01 | Medium | Event creation | Event creation uses a minimal date plus event-type selection, while event types/timezone configuration is loaded asynchronously. If configuration fetch fails, the catch intentionally suppresses the error. | Users may see an incomplete event-type choice without understanding why configuration is missing. | Visibility of system status; error diagnosis | Expose a non-blocking configuration warning/retry state and prevent invalid creation when required configuration is unavailable. | Low–Medium | Fewer silent configuration failures. |
| PLATFORM-01 | Low | Platform admin navigation | The sidebar exposes only Platform admin and Subscriptions directly; guild/user/impersonation management appears to be reached through the admin landing page. | Additional navigation step for frequent platform operations. | Flexibility and efficiency | Consider contextual admin shortcuts or a compact admin submenu, based on observed frequency and role needs. | Low | Faster platform operations without cluttering guild users' navigation. |

## Potential improvements requiring runtime validation

1. The global table primitive supports horizontal overflow and an optional mobile card presentation, but individual tables must be checked to ensure they use it consistently and expose row labels correctly in card mode.
2. Dialog styling exists globally; each modal/drawer still needs interaction checks for focus trapping, initial focus, Escape behavior, focus return, and accessible title/description.
3. Global focus-visible styling and reduced-motion support are present. Actual contrast ratios, target sizes, focus visibility against all page-specific surfaces, and keyboard order still require browser testing.
4. The mobile navigation breakpoint is 700px, while a separate sidebar width adjustment exists at 900px. Test tablet widths and long guild/user names for clipping and awkward transitions.
5. The dashboard and event screens should be tested with empty, loading, API failure, no-permission and large-data states. Source review alone cannot establish whether these states are understandable.
6. All critical management operations (member edits, recruitment decisions, event changes, roster generation, allocations/bids, result uploads) require destructive-action and recovery review at the individual component/API level.

## Baseline scorecard (provisional, source-review only)

Scores are directional hypotheses, not validated usability-test scores. They will be revised after route/component inspection and runtime checks.

| Module | Learnability | Efficiency | Discoverability | Consistency | Error prevention | Accessibility | Overall |
|---|---:|---:|---:|---:|---:|---:|---:|
| Global navigation / shell | 6 | 7 | 6 | 6 | 6 | 5 | 6 |
| Member portal / profile | 7 | 7 | 7 | 6 | 6 | 5 | 6 |
| Member directory / roles | 5 | 6 | 6 | 6 | 5 | 5 | 6 |
| Events / rosters / results | 5 | 6 | 5 | 5 | 5 | 5 | 5 |
| Recruitment / applications | Not scored yet | Not scored yet | Not scored yet | Not scored yet | Not scored yet | Not scored yet | Not scored yet |
| Leave / availability | 6 | 6 | 6 | 5 | 5 | 5 | 6 |
| Resources / bidding / allocation | Not scored yet | Not scored yet | Not scored yet | Not scored yet | Not scored yet | Not scored yet | Not scored yet |
| Statistics / rankings | 5 | 6 | 5 | 5 | 5 | 5 | 5 |
| Guild settings / notifications | Not scored yet | Not scored yet | Not scored yet | Not scored yet | Not scored yet | Not scored yet | Not scored yet |
| Platform administration | 6 | 6 | 6 | 6 | 6 | 5 | 6 |

## Implementation order

### Phase A — high-confidence corrections
1. Correct Events/Rosters active navigation state.
2. Make mobile navigation keyboard and screen-reader complete.
3. Align leave-member lookup with established account-linking behavior.
4. Review and harden statistics route/API authorization.
5. Surface event-type configuration loading failures.

### Phase B — workflow and information architecture
1. Inspect the full member directory client workflow and create useful column presets.
2. Review event, roster, attendance and results journeys end-to-end.
3. Review recruitment, leave management, resources, allocation and bidding flows.
4. Improve contextual shortcuts and task completion feedback where evidence supports it.

### Phase C — validation
1. Build, TypeScript, lint and available automated tests.
2. Verify role-based access and guild scoping.
3. Browser-test desktop/tablet/mobile workflows where browser access is available.
4. Keyboard and screen-reader checks; contrast and touch-target checks.
5. Re-score modules and document unresolved issues.

## Audit limitations

This first pass is based on repository source inspection. No authenticated browser session or live interaction test was performed in this phase. The GitHub connector does not expose a repository tree/listing operation in the available toolset, so the route inventory is being assembled by inspecting known route entry points and referenced components; the inventory is not yet certified exhaustive. Build/lint/test commands cannot be executed through the GitHub connector. A local or CI build result will be required for implementation validation.
