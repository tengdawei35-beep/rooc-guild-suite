-- Casual is a distinct low-cost tier. It intentionally shares CORE module
-- entitlement for the first rollout; feature-level restrictions are enforced
-- separately and must be added before enabling the plan in production.
INSERT INTO "Plan" ("id", "name", "description", "priceCents", "currency", "billingInterval", "active", "createdAt", "updatedAt")
VALUES ('casual_plan', 'Casual', 'Essential guild management for smaller communities', 199, 'usd', 'MONTH', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "priceCents" = EXCLUDED."priceCents",
  "currency" = EXCLUDED."currency",
  "billingInterval" = 'MONTH',
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanModule" ("id", "planId", "module", "createdAt")
SELECT 'casual_core_module', p."id", 'CORE', CURRENT_TIMESTAMP
FROM "Plan" p
WHERE p."name" = 'Casual'
ON CONFLICT ("planId", "module") DO NOTHING;
