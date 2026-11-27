# Durable Stripe Checkout Reservation Design

Status: proposed implementation design; not yet implemented.

## Problem

Both `POST /api/billing/checkout` and `POST /api/billing/combat-simulator/checkout` check for an active subscription and then create a Stripe Checkout Session. Two concurrent requests can both pass the check before either session completes. Stripe can then create two independent subscription-mode sessions and, if both are completed, two subscriptions.

The base checkout webhook's duplicate-delivery recovery (lookup by Stripe subscription ID) addresses retries of one completed session. It does not prevent two distinct sessions from being created.

## Goals

- Enforce at most one live checkout attempt for a given purchase target across all app instances.
- Make retries of the same logical request converge on the same Stripe Checkout Session using a persisted Stripe idempotency key.
- Reject a competing request with different purchase parameters while a session is still open.
- Permit a fresh attempt after Stripe reports the prior session expired, or after a safely recovered failed creation.
- Reconcile webhook delivery, including duplicate and out-of-order `checkout.session.completed` and `checkout.session.expired` events.
- Keep the reservation and subscription checks authoritative in the database; do not rely on process-local memory.
- Preserve current affiliate, discount, onboarding, base-plan and add-on semantics.

## Reservation identity and request fingerprint

Use a durable reservation keyed by a canonical `scopeKey`:
- Existing guild base plan: `base:guild:<guildId>`
- New guild onboarding: `base:discord-guild:<discordGuildId>`
- Personal simulator add-on: `simulator:user:<userId>`
- Guild simulator add-on: `simulator:guild:<guildId>`

Persist a normalized request fingerprint covering the purchase target, plan/price, billing term, and any material purchase metadata (including affiliate selection where it affects the Stripe session). If an open reservation exists with a different fingerprint, return a conflict rather than silently changing the user's purchase. The owner and target authorization checks must still run on every request.

## Suggested persistence model

Add a `BillingCheckoutReservation` model with:
- `id` (cuid primary key), `scopeKey` (unique), `requestFingerprint`
- `status`: CREATING, OPEN, COMPLETED, EXPIRED, FAILED
- `attempt` integer, `stripeIdempotencyKey` unique
- `stripeCheckoutSessionId` unique nullable, `checkoutUrl` nullable
- `leaseExpiresAt`, `sessionExpiresAt`, `completedAt`, `lastError`
- timestamps and indexes on status/lease and session expiry

A single row per purchase scope represents the current attempt. Increment `attempt` only when beginning a genuinely new attempt after the prior one is terminal. Include both reservation ID and attempt number in Stripe Session metadata so webhook events from an older attempt cannot expire or complete a newer attempt.

## Creation protocol

1. Authenticate and validate the request, re-check ownership, active entitlement and target uniqueness.
2. In a short database transaction, create or claim the unique scope reservation. A concurrent insert/claim must resolve through the unique key and a conditional update/row lock. Do not hold a database transaction open while calling Stripe.
3. For a new attempt, persist a deterministic idempotency key derived from reservation ID and attempt, plus a short creation lease and request fingerprint.
4. Call Stripe with that idempotency key and reservation metadata. Retries for the same attempt must use exactly the same key and identical Stripe parameters.
5. Persist the returned session ID, URL and Stripe `expires_at`; transition to OPEN only if the attempt still matches.
6. If the process dies after Stripe creates the session but before persistence, a retry reuses the same Stripe idempotency key and recovers the same session. A lease expiry alone must not rotate the key while Stripe's idempotency record may still be valid.
7. If the same request arrives while OPEN, retrieve the existing Stripe session and return its URL only if it is still open. If it is complete/expired, reconcile state before allowing another attempt.

## Webhook protocol

- Add `billingCheckoutReservationId` and `billingCheckoutAttempt` to both base and add-on Checkout Session metadata (and subscription metadata if useful for reconciliation).
- On `checkout.session.completed`, verify the reservation ID/attempt and session ID, process the subscription idempotently, and mark the matching attempt COMPLETED. Do not let an older attempt overwrite a newer attempt.
- On `checkout.session.expired`, mark only the matching reservation attempt EXPIRED. Ignore stale events for an earlier attempt.
- Preserve current subscription lifecycle handling and ensure a completed reservation is not reset by a delayed expiration event.
- Consider retrieving the current Checkout Session from Stripe when event/session state is ambiguous, as already done for subscription lifecycle events.
- Webhook retries must remain safe if subscription persistence succeeds but reservation state update or downstream Discord/affiliate synchronization fails.

## Failure recovery and expiry

- A Stripe API timeout is ambiguous: retry the same idempotency key; never assume no session was created.
- A definitive validation/API failure can mark the attempt FAILED, but only after classifying whether Stripe could have created a session.
- An expired lease with no stored session ID requires retrying the same idempotency key first. Rotate to a new attempt only after confirming the previous attempt cannot yield a live session (or after Stripe's idempotency retention window and a reconciliation check).
- Do not automatically free a scope merely because a local timestamp elapsed if Stripe may still have an open session.

## Test plan

Automated tests should cover:
- Two simultaneous requests for the same scope produce one reservation attempt and one Stripe session.
- Same fingerprint retries return/recover the same session; different fingerprints receive a conflict.
- Different scopes can proceed independently.
- A crash between Stripe session creation and DB persistence is recovered with the same idempotency key.
- Expired sessions permit a new attempt; stale expiration events cannot expire a newer attempt.
- Completion and expiration webhook duplicates are idempotent.
- Completion racing with expiration leaves the reservation completed.
- Base onboarding, existing guild base plan, personal add-on and guild add-on all use the shared protocol.
- Authorization and active-subscription checks are repeated and cannot be bypassed by a pre-existing reservation.

## Rollout and operational boundary

This requires a Prisma schema migration and a generated SQL migration. The implementation PR may add the migration and automated tests, but must not apply it to production. Production migration, deployment ordering, and Stripe test-mode validation must be explicit operator actions. No production database writes or Stripe transactions are authorized by this design note.

## Out of scope

- Complimentary-to-paid conversion policy (Issue #163).
- Changes to plan pricing, discounts, Stripe products, or entitlement policy.
- Live Stripe transactions or production database migration.
