-- Rename application access roles.
--
-- IMPORTANT:
-- MemberPriority is intentionally NOT changed.
-- It represents in-game member priority, not application access.

ALTER TYPE "UserRole"
RENAME VALUE 'LEADER' TO 'ADMIN';

ALTER TYPE "UserRole"
RENAME VALUE 'COUNCIL' TO 'MANAGER';