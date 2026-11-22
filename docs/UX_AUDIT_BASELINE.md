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
| NAV-02 | Medium | Mobile AppShell navigation | Before this audit, the mobile menu had no Escape-key dismissal or focus restoration. The toggle already exposed expanded/collapsed state. | Keyboard users had no explicit keyboard shortcut to dismiss the expanded navigation. | WCAG 2.2 AA; user control | Add Escape dismissal and return focus to the toggle; validate the full disclosure pattern with keyboard and screen reader. | Low–Medium | More predictable mobile navigation. |
| NAV-03 | Low | AppShell mobile menu button | Before this audit, the accessible name was the generic visible text “Menu” / “Close”. | Screen-reader users received limited context about what the control opens or closes. | Accessibility; recognition over recall | Use explicit “Open navigation menu” / “Close navigation menu” labels. | Low | Better assistive-technology clarity. |
| NAV-04 | Medium | AppShell active navigation | Active state is implemented with `aria-current=page` for group links, but the query-view collision means the semantic current-page signal may be applied to multiple links. | Screen readers may announce more than one current page. | WCAG; system status | Ensure exactly one matching navigation item for the active route/view. | Low | Reliable current-location announcement. |
| HOME-01 | Medium | Management dashboard | Dashboard computes “today” using a fixed `Asia/Bangkok` timezone, while guilds have a configurable `timeZone` field and events have `scheduleTimeZone`. | Guilds in other timezones may see incorrect today/availability/event counts or date boundaries. | Match system to real world; error prevention | Use guild-configured timezone consistently, with a documented fallback and clear display of the timezone used. | Medium | More trustworthy operational summaries. |
| PEOPLE-01 | High | Member directory / self-service actions | The directory's own-profile permission check and leave application initially relied on `userId` alone, while other member lookup paths also support `discordUserId`. | Discord-linked accounts with no populated userId could be unable to edit their own profile or manage their own availability despite having a linked member record. | Error prevention; consistency | Use the authenticated Discord identity as a secondary match, with guild scoping and active-member checks. | Low–Medium | Makes self-service behavior consistent with account linking. |
| INSIGHT-01 | Medium | `/guild/statistics` page | The page component initially lacked page-level authentication and permission checks, although both inspected statistics API routes already enforce authenticated, guild-scoped `members.view` access. | Access behavior was inconsistent with the adjacent rankings page and unauthenticated users could receive a client-rendered shell before API rejection; no API data exposure was observed in the inspected handlers. | Consistency; visibility of system status; error prevention | Add the same page-level auth and permission gate used by rankings. | Low | Consistent access behavior and earlier redirect. |
| PEOPLE-02 | Medium | Member directory | The page loads every guild member and all leave dates for the guild before passing the dataset to a client component. | Large guilds may experience slower initial load, heavier client payloads and less efficient scanning. | Efficiency; cognitive load | Inspect client-side filtering and actual data volume; introduce server-side pagination/search only if current behavior is measurably costly, preserving existing analytics needs. | Medium–High | Better performance at scale. |
| PEOPLE-03 | Medium | Member directory field configuration | The directory supports a very broad set of ROOC/RO3 fields and persisted display-field selection. This is powerful but creates a large configuration surface. | Users may need to understand many game-specific metrics before finding the few fields needed for routine roster management. | Progressive disclosure; Hick's Law | Provide role/task-oriented presets (e.g. roster, combat, profile) while retaining custom columns. Validate discoverability and persistence. | Medium | Faster scanning with advanced control retained. |
| EVENTS-01 | Medium | Event creation | Event creation uses a minimal date plus event-type selection, while event types/timezone configuration is loaded asynchronously. If configuration fetch fails, the catch intentionally suppresses the error. | Users may see an incomplete event-type choice without understanding why configuration is missing. | Visibility of system status; error diagnosis | Expose a non-blocking configuration warning/retry state and prevent invalid creation when required configuration is unavailable. | Low–Medium | Fewer silent configuration failures. |
| PLATFORM-01 | Low | Platform admin navigation | The sidebar exposes only Platform admin and Subscriptions directly; guild/user/impersonation management appears to be reached through the admin landing page. | Additional navigation step for frequent platform operations. | Flexibility and efficiency | Consider contextual admin shortcuts or a compact admin submenu, based on observed frequency and role needs. | Low | Faster platform operations without cluttering guild users' navigation. |
| NOTIFY-01 | Medium | Guild notification settings | The form initially allowed Save before the asynchronous settings fetch completed; a user could submit a partially initialized form while existing channel configuration was still loading. | Accidental clearing or overwriting risk, and unclear loading status. | Visibility of system status; error prevention | Show loading state, disable Save until settings load, and provide a retry path if loading fails. | Low | Prevents premature submission and improves recovery. |
| RECRUIT-01 | Medium | Recruitment queue | Applicant search and status filtering are present, but decision actions rely on generic browser confirmation and the queue has no explicit per-applicant pending state; one shared busy flag disables all actions while any action runs. | Users receive limited context during decisions and cannot distinguish which record is processing. | Visibility of system status; user control | Add per-record processing feedback and clearer decision confirmation context while retaining a final confirmation for irreversible decisions. | Medium | More precise feedback and fewer accidental repeated actions. |
| RESULTS-01 | Medium | Event results archive API | The archive endpoint retrieves every result image for the guild and groups the full result set in memory without pagination or a bounded window. | As event history grows, archive response size, server memory use and page rendering work grow without a practical limit. | Efficiency; scalability; progressive disclosure | Add event-level pagination or date filtering with a clear total/continuation pattern; retain guild scoping and stable ordering. | Medium | Keeps archive browsing responsive for long-lived guilds. |
| LEAVE-01 | Medium | Leave history page | The page loads every current leave row and every archived LeaveHistory row, then groups and sorts all records in application memory. | Historical leave data grows indefinitely and can increase server query time and memory use. | Efficiency; scalability | Introduce date range/search and paginated member summaries, or aggregate counts in the database; preserve the current/former member distinction. | Medium–High | Predictable performance as the guild's history grows. |
| RESOURCE-01 | Medium | RO3 Resource Pools — event type configuration | The event type configuration request silently ignored HTTP and network failures, leaving the selector empty with no explanation or retry. | Managers could incorrectly conclude that no event types exist or be blocked from configuring reward pools without a recovery path. | Visibility of system status; error recovery | Expose loading/error states, retry, and distinguish a genuine empty configuration from a failed request. | Low | Makes configuration failures diagnosable and recoverable. |
| RESOURCE-02 | Medium | RO3 Resource Pools — save/refresh flow | After a successful mutation, a failed follow-up GET was caught as though the save itself had failed. | The UI could report a failed save after the server had already committed it, encouraging duplicate create actions on retry. | Feedback; error prevention | Separate mutation success from refresh failure and tell the user when a change was saved but the displayed data needs reloading. | Low | Prevents duplicate actions and misleading feedback. |
| RESERVE-01 | High | Bulk reservations | Bulk add/edit used `Promise.all`; if any one request failed, successful sibling writes were discarded from client state and the form remained unchanged. Retrying could conflict with already-created reservations. | A partially completed operation looked like a total failure, making it difficult to know which member reservations were saved and making retry unsafe. | Error prevention; visibility of system status; recovery | Process entries with per-entry outcomes, apply successful results immediately, retain only failed entries for retry, and announce batch progress/errors. | Medium | Safe recovery from partial batch failure without duplicate submissions. |

| ALLOC-01 | Medium | Allocation preview — member count | The input starts blank, but validation used `Number("")`, which evaluates to zero. A user who left the field untouched could unintentionally generate and run an allocation with zero non-reserved members. | An omitted value was silently treated as a deliberate zero, making a consequential allocation easier to run with an unintended parameter. | Error prevention; match between system and real world | Require an explicit value; explain that zero is valid when there are genuinely no non-reserved participants. | Low | Prevents accidental zero-member allocations. |
| ALLOC-02 | Low | Allocation reservation controls | Quick reservation selectors and quantity input did not expose explicit accessible names, and reservation deletion had no per-record pending state. | Screen-reader labels were dependent on surrounding visual layout, and repeated deletion clicks could issue overlapping requests before the UI updated. | Accessibility; visibility of system status | Add explicit accessible names, disable concurrent deletes and announce errors/success states. | Low | More reliable keyboard/screen-reader use and clearer action feedback. |
| HISTORY-01 | Low | Allocation history tables | The three allocation-history tables did not expose explicit accessible table names or column-header scope semantics. | Assistive technologies may have less reliable context when navigating wide resource and member allocation tables. | WCAG; information relationships | Add accessible table names and explicit column header scopes; validate with a screen reader. | Low | Clearer table navigation. |
| BID-01 | Low | Bid allocation pages | Feather/Card selectors exposed only visual active styling, and page-number controls lacked accessible labels/current-page semantics. | Keyboard and screen-reader users had less context about the active allocation type and current page. | WCAG 2.2 AA; visibility of system status | Expose selected state on type controls and accessible names/current-page semantics on pagination. | Low | More reliable navigation with assistive technology. |
| RANK-01 | Low | Guild Rankings search | The search placeholder claimed it searched Discord names, but the filter only matched character name and job. Load errors were also not exposed as an alert to assistive technology. | Users could search a Discord name and incorrectly conclude that the member was absent; screen-reader users may miss load errors. | Match between system and real world; accessibility | Align the placeholder with actual searchable fields and announce errors. | Low | More accurate expectations and accessible error feedback. |
| ADMIN-01 | Medium | Platform Users directory | The page retrieves every user plus each user's guild memberships, character records and owned guilds in one unpaginated query, then constructs all affiliation summaries in memory. | Payload and server work grow with total platform accounts and related records; client-side filtering cannot reduce the initial transfer. | Efficiency; scalability; progressive disclosure | Add server-side search/filtering and pagination while computing summary totals with database aggregates. | Medium–High | Keeps platform administration responsive as HMDL grows. |
| ADMIN-02 | Medium | Platform Guild portfolio | The page retrieves every guild and also loads every active member row to derive active and linked-user counts, despite the page displaying aggregate counts rather than individual members. | The query transfers unnecessary per-member records and the whole guild portfolio grows unbounded. | Efficiency; scalability | Replace member-row loading with database counts/aggregates and introduce server-side pagination for the portfolio. | Medium | Reduces query payload and improves admin performance at scale. |

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


## Implementation progress — Phase A (in progress)

The following source-level changes have been committed to the audit branch only:

| Finding | Change | Status |
|---|---|---|
| NAV-01 / NAV-04 | Sidebar active state now respects the `view` query parameter so Events, Rosters and Preferred Rosters do not all appear selected together. The Event Results archive is excluded from the generic Events active state. | Implemented; build/runtime validation pending |
| NAV-02 / NAV-03 | Mobile navigation now dismisses on Escape and returns focus to its toggle; the toggle has explicit open/close accessible names. | Implemented in source; keyboard/screen-reader runtime review pending |
| Touch targets | Sidebar navigation links and the mobile menu toggle now use a 44px minimum height. | Implemented in CSS; visual/browser measurement pending |
| PEOPLE-01 | Leave application resolves the authenticated member by either linked user ID or Discord ID, matching the member directory and API authorization logic; inactive profiles are excluded. | Implemented; workflow test pending |
| INSIGHT-01 | Guild Statistics now applies page-level authentication and `members.view` permission checks, matching Rankings. The API handlers were separately inspected and already enforce guild-scoped authentication and permission checks. | Implemented; role test pending |
| EVENTS-01 | Event type configuration now has explicit loading/error feedback and retry. Event creation remains disabled while configuration is loading or unavailable, preventing an incorrect default event type from being submitted. | Implemented; failure-state test pending |



### Phase A — additional workflow corrections

| Finding | Change | Status |
|---|---|---|
| HOME-01 | Management dashboard “today” calculations now use the guild's configured timezone, with Asia/Bangkok retained only as the fallback when no timezone is configured. Midnight boundaries are calculated independently for the start and next day to account for daylight-saving transitions. | Implemented in source; timezone-specific test/build pending |
| PEOPLE-03 | Added task-oriented member directory column presets: Overview, Roster and Combat. Existing individual field selection and per-user local persistence remain available. | Implemented in source; game-type/persistence checks pending |
| NOTIFY-01 | Notification settings now show an initial loading state, disable Save until settings have loaded, announce success/error feedback and offer retry when loading fails. | Implemented in source; failure-state test pending |
| RECRUIT-01 | Recruitment decision confirmation now identifies the applicant and explains what accepting or denying does. The affected row shows processing feedback and an accessible status announcement. | Implemented in source; decision workflow test pending |

Recruitment decision confirmation now names the applicant and explains the consequence of acceptance or denial. The affected applicant receives a processing label and an accessible status announcement while the request is running. This is implemented in source; decision workflow testing remains pending.

These changes are not merged or deployed. The remaining audit and validation phases are still required.


### Phase B — event result workflow review

| Finding | Change | Status |
|---|---|---|
| RESULTS-UPLOAD-01 | Upload selection now validates the 12-file batch limit, accepted MIME types and 4 MB per-file limit before submission. If a batch partially fails, successfully uploaded files are removed from the retry selection so retrying does not duplicate them; remaining files stay selected and progress/error feedback explains the partial result. | Implemented in source; failure/retry workflow and build validation pending |

The event results archive and leave history are confirmed unbounded at the query level (RESULTS-01 and LEAVE-01). These are documented as scalability risks; pagination/aggregation is not being added until the appropriate archive interaction and summary semantics are designed.


### Phase B — resource and results workflow corrections

| Finding | Change | Status |
|---|---|---|
| RESULTS-UPLOAD-01 | Upload selection validates batch count, MIME type and 4 MB size before submission. Partial failures retain only files that were not uploaded, preventing duplicate uploads on retry. A completed upload with a failed list refresh is now reported separately and does not imply that files remain to retry. | Implemented in source; build and failure/retry workflow validation pending |
| RESOURCE-01 | RO3 resource pool event-type configuration now has loading, explicit error and retry states. The selector and add action are disabled while loading or after a failed fetch; a genuine empty active-event-type state explains how to resolve it. | Implemented in source; runtime failure/empty-state validation pending |
| RESOURCE-02 | Resource pool mutations and the subsequent refresh are now treated separately. If the mutation succeeds but the refresh fails, the UI says the change was saved and asks the user to reload rather than implying the save failed. | Implemented in source; mutation/refresh failure testing pending |

The event results archive and leave history remain unbounded at the query level (RESULTS-01 and LEAVE-01). These are documented scalability risks; pagination/aggregation is not being added until the appropriate archive interaction and summary semantics are designed.


| RESERVE-01 | Bulk reservations now process entries sequentially and preserve successful server writes in client state. Failed entries remain in the form while successful entries are removed, so retry targets only failures. The UI announces progress and exposes errors with an alert role. | Implemented in source; partial-failure and keyboard workflow testing pending |


### Phase C — allocation, bidding and platform administration

| Finding | Change | Status |
|---|---|---|
| ALLOC-01 | Allocation member count now requires an explicit value. The helper text explains that 0 is valid only when there are genuinely no non-reserved participants; blank no longer silently becomes zero. | Implemented in source; build and allocation workflow validation pending |
| ALLOC-02 | Quick reservation controls and per-member allocation override controls now have explicit accessible names; deletion requests are serialized with per-record pending feedback, and error/success messages use status/alert semantics. | Implemented in source; keyboard and concurrent-action testing pending |
| RANK-01 | Rankings search prompt now accurately describes character/job matching and load failures are announced as alerts. Bid-page search result changes now announce result counts and empty states; Feather/Card selectors expose pressed state and pagination exposes accessible labels and current-page semantics. | Implemented in source; assistive-technology testing pending |

The platform Users and Guilds pages have confirmed unbounded server queries. Users includes nested membership and character data for every account; Guilds additionally loads each active member row to derive aggregate counts. These risks are documented as ADMIN-01 and ADMIN-02. Pagination and aggregate query redesign are deferred until the page-level summary/filter semantics are agreed.

| BID-01 | Bid allocation type selectors and pagination now expose their active/current state and accessible names. | Implemented in source; keyboard and screen-reader testing pending |

| HISTORY-01 | Allocation history tables now have accessible names and explicit column-header scopes. | Implemented in source; screen-reader validation pending |


### Phase B — configuration workflow corrections

| Finding | Change | Status |
|---|---|---|
| NOTIFY-02 | Notification webhook test actions now expose a per-channel pending label and cannot be triggered concurrently with another test, save or configuration load. Webhook fields and the event attendance channel ID have explicit accessible names. | Implemented in source; runtime and assistive-technology validation pending |
| NOTIFY-03 | Saving notification settings is now reported as successful independently from the follow-up configuration refresh. A failed refresh no longer falsely implies that the server-side save failed; the user is prompted to retry loading. | Implemented in source; mutation/refresh failure test pending |
| EVENT-TYPE-01 | RO3 event type weekday controls expose pressed state and are grouped in a fieldset; timezone selection has an explicit label. Configuration errors are announced and include a retry action. | Implemented in source; keyboard and screen-reader validation pending |
| EVENT-TYPE-02 | Event type create, enable and delete operations now distinguish successful mutation from a failed list refresh, avoiding a misleading failure message after a committed change. | Implemented in source; mutation/refresh failure test pending |

The source review also confirmed that the event list currently retrieves all guild events and the client sorts them into upcoming and past groups. This may become a performance concern for long-lived guilds; it is not yet scored as a verified bottleneck because actual guild data volume and response timings have not been measured. The event date API stores ROOC calendar dates at UTC+7 while RO3 events use each configured event timezone; the client-side upcoming/past grouping should receive a dedicated timezone-boundary test before any date logic is changed.

### Latest automated validation snapshot

- GitHub Actions CI was successful for commit `b75666c32a77c657f2acf4346298ad4e4a5cdbde`.
- Subsequent notification and event-type UX commits require their own CI result before this tranche can be called build-validated.
- Vercel deployment/build status for the newest branch head has not yet been confirmed.
- No authenticated browser, visual, responsive, keyboard or screen-reader test has been performed through the available environment.


### Phase B — roster administration feedback

| Finding | Change | Status |
|---|---|---|
| ROSTER-DELETE-01 | Roster deletion now prevents overlapping delete requests, shows a per-roster “Deleting…” state, and reports failures through the event page's accessible alert instead of a browser alert. | Implemented in source; destructive-action and keyboard validation pending |

The event detail page also refreshes event/roster data every 10 seconds while visible so attendance changes made through Discord or HMDL are reflected. This behavior is source-verified; network/polling performance and concurrent editing behavior still need runtime testing.


### Phase B — Call To Arms and attendance accessibility

| Finding | Change | Status |
|---|---|---|
| CALLS-01 | Call To Arms creation and Discord settings overlays now expose dialog semantics, initial focus, Escape dismissal, focus trapping and focus restoration. Close controls have accessible names. | Implemented in source; keyboard/screen-reader runtime validation pending |
| CALLS-02 | Call date, hour, minute, requirement and quantity controls now have explicit accessible names; requirement removal has a contextual accessible name. Modal errors are announced. | Implemented in source; form workflow and assistive-technology validation pending |
| CALLS-03 | Discord settings failures are shown inline as an accessible alert rather than a browser alert; the webhook field is explicitly labelled. | Implemented in source; failure/retry validation pending |
| CALLS-04 | Call To Arms page now uses the standard page-authentication guard and redirects users without `events.view` permission rather than rendering a blank page for unauthenticated access. | Implemented in source; permission matrix validation pending |
| ATTEND-01 | Event attendance response controls expose their selected state with `aria-pressed`, and attendance loading errors are announced as alerts. | Implemented in source; keyboard and screen-reader validation pending |

The event detail page and attendance panel both poll at 10-second intervals while the page is visible. This can produce overlapping requests under slow network conditions; request cancellation/deduplication and concurrent-edit behavior remain runtime review items.


### Phase C — platform directories and resource configuration

| Finding | Change | Status |
|---|---|---|
| ADMIN-USERS-UX-01 | Platform user directory now announces the filtered/total result count to assistive technology; the empty-state clear-filter action is explicitly a button. | Implemented in source; screen-reader validation pending |
| ADMIN-GUILDS-UX-01 | Platform guild directory now announces the filtered/total result count; the clear-filter action is explicitly a button. | Implemented in source; screen-reader validation pending |
| RESOURCE-UX-01 | RO3 resource pool creation, pool selection, item creation and category controls have explicit accessible names. Resource mutation errors are announced as alerts and cap-save feedback is exposed as a polite status. | Implemented in source; form and assistive-technology validation pending |

#### Platform directory scalability — confirmed source-level design risk

- `/admin/users` currently loads every User and all selected guild membership, guild member and owned-guild relations, then constructs a complete client-side directory and summary in memory.
- `/admin/guilds` currently loads every Guild, latest subscription, all active member IDs and aggregate counts before rendering the complete client-side directory.
- Search and filters are client-side only. This is acceptable for a small installation but work and payload scale linearly with the platform population and associated relationships. Actual performance impact has not been measured.
- A future scalable implementation should use server-side query filters, stable cursor pagination, database aggregates for summary cards, and an explicit definition of whether summary totals reflect all records or only filtered records. This is intentionally not approximated with arbitrary client-side truncation because it would make platform totals and filters incorrect.

### Validation update

- Vercel and GitHub Actions CI both passed for commit `a4f8826a161fefa4e12da7e003e1149c0db7dbfe`.
- Subsequent platform-directory and RO3 resource UX commits require a fresh build/CI result.
- No manual browser, responsive, keyboard, screen-reader or production-data performance testing has been performed.


### Phase B — live event refresh reliability

| Finding | Change | Status |
|---|---|---|
| EVENT-POLL-01 | Event detail polling now prevents overlapping refresh requests, aborts an in-flight request on unmount/event change, and ignores refresh results after cleanup. | Implemented in source; network/concurrent-edit runtime validation pending |
| ATTEND-POLL-01 | Attendance polling now serializes refresh requests, pauses while a member is submitting a response, ignores late refresh results during an active response, refreshes on tab visibility, and aborts on unmount/event change. | Implemented in source; network/concurrent-edit runtime validation pending |

These changes reduce avoidable duplicate requests and prevent a periodic attendance refresh from overwriting the immediate response state while a submission is in progress. They do not establish that polling is optimal for production scale; a server-push or shared event refresh strategy may be preferable if measured traffic warrants it.

### Latest automated validation snapshot

- Commit `74f1e236d22608ed56b5a84b3e7872a694a185fc`: Vercel status **success** and GitHub Actions CI **success**.
- Subsequent polling reliability commits (`b8ee439`, `1024d19`, `7e34830`) have been pushed to the audit branch. Their CI/build checks must be confirmed separately before calling these changes validated.
- No authenticated browser, responsive, keyboard, screen-reader or production-data performance testing has been performed.


### Phase B — settings, ownership and onboarding feedback

| Finding | Change | Status |
|---|---|---|
| ONBOARD-01 | Role onboarding now distinguishes loading, failed initial load and a genuinely unavailable guide; a retry action is available instead of silently rendering nothing. A successful progress save followed by a failed refresh is reported accurately. | Implemented in source; runtime verification pending |
| GUILD-SETTINGS-01 | Guild settings prevent submitting blank/whitespace-only name or Discord server ID values and expose save errors/success to assistive technology. Existing API validation and game-switch confirmation remain unchanged. | Implemented in source; runtime verification pending |
| OWNERSHIP-UX-01 | Ownership transfer now communicates when no eligible alternate guild user exists, disables the empty selector/action, and announces success/errors accessibly. Existing ownership confirmation and API contract remain unchanged. | Implemented in source; runtime verification pending |

### Latest automated validation snapshot

- The earlier commit `74f1e236d22608ed56b5a84b3e7872a694a185fc` had Vercel and GitHub Actions CI success.
- The later event polling commits and settings/onboarding changes are newer and have not yet been validated by a completed CI/build run.
- At the time of the latest check, GitHub Actions CI run `45025022720` was **in progress** and Vercel was **pending** for the previously checked commit. Recheck the branch head before treating any check as current.
- No authenticated browser, responsive, keyboard, screen-reader or production-data performance testing has been performed.


### Phase B — allocation permission affordance

| Finding | Change | Status |
|---|---|---|
| ALLOC-PERM-01 | The allocation preview API already distinguished `allocation.view` from `allocation.run`, and the run API independently enforced `allocation.run`. The preview UI nevertheless left the Run Allocation button enabled for view-only users, inviting a predictable 403. The button is now disabled without run permission and the page explains that the preview is view-only. Event and member-count controls also have explicit accessible names. | Implemented in source; role-matrix runtime validation pending |

The API-side permission checks remain authoritative; this change improves the affordance and avoids inviting an action the current role cannot perform.


### Phase B — reservation permission and destructive-action feedback

| Finding | Change | Status |
|---|---|---|
| RESERVE-PERM-01 | Reservation page previously exposed Add, Bulk Add/Edit, Edit and Delete controls to users with view-only allocation permission, although mutation APIs correctly returned 403. The page now passes the role-derived `allocation.run` capability to the client; mutation controls and forms are hidden/disabled for view-only users while read access remains available. | Implemented in source; role-matrix runtime validation pending |
| RESERVE-DELETE-01 | Reservation deletion previously had no in-flight guard or per-row progress state, allowing repeated destructive requests and giving no feedback while waiting. Deletion is now serialized with a row-specific “Deleting…” state and disabled competing edit/delete actions. | Implemented in source; runtime validation pending |
