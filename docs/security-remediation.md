# Security remediation

This document tracks the source-level remediation work associated with the November 2026 security audit.

## Explicitly excluded

- Discord guild ownership verification during onboarding is intentionally unchanged, per product-owner instruction. Do not add Discord `guilds` OAuth scope or server permission verification without renewed approval.

## Implemented in this branch

- Expired guild subscriptions now produce an role-specific `READ_ONLY_*` role in guild-scoped authentication. Read permissions remain available; write permissions are denied. Billing/platform authentication remains separate so owners can renew.
- Preserved original role information for read-only data visibility, including member-directory filtering, user directory visibility, onboarding guide visibility, attendance visibility, and watchlist reads.
- Added explicit inactive-subscription guards to self-service mutations that do not use normal role permissions: event attendance, RO3 opt-ins, Call To Arms actions, ownership transfer, Discord attendance interactions, and applicant submissions.
- Added database-backed session-version revocation for guild, platform, and applicant sessions. Logging out increments the user's session version and invalidates previously issued tokens.
- Added Discord interaction timestamp freshness checks and unique interaction receipts to reject stale/replayed attendance interactions.
- Added atomic PostgreSQL-backed rate limits to member and applicant OCR endpoints.
- Added bounded streaming multipart parsing, aggregate upload ceilings, image signature/decoder validation, pixel limits, and image normalization for OCR and event-result uploads.
- Added a hard streaming body ceiling to the public Discord interactions endpoint to prevent unbounded buffering of unauthenticated webhook requests.
- Added a request-wide decoded-pixel budget for OCR screenshots and sequential normalization to limit decompression-bomb memory amplification.
- Logout redirects now use the configured `APP_URL` origin rather than forwarded host/protocol headers.
- CI now runs the full repository lint, production dependency audit, security upload/access-policy tests, and CodeQL analysis.

## Database migration required

The branch adds these Prisma changes:

- `User.sessionVersion`
- `DiscordInteractionReceipt`
- `RateLimitBucket`

The corresponding migrations are included under `prisma/migrations`. CI applies them to its disposable PostgreSQL service. **Do not deploy the application changes before applying these migrations to the production database.** No production migration or production data change has been performed as part of this work.

## Repository settings requiring an owner action

GitHub dependency graph, secret scanning and push protection are repository security settings, not safely enabled by application code. The dependency-review workflow was not retained because GitHub reports that dependency graph is currently disabled for this repository. Enable **Dependency graph** and **Secret scanning / push protection** under **Settings → Security → Code security and analysis** if supported by the repository plan. Review and resolve any existing secret alerts before enabling push protection.

## Validation status

Automated checks are added to CI, but must pass on the pull request before merge. Production behavior, Stripe billing flows, Discord interactions, upload limits at the Vercel edge, and read-only UX still require deployment and manual verification. No penetration test or unauthorized production access test was performed.
