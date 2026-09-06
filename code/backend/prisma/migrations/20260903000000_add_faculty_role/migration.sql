-- Additive only: adds FACULTY as a new UserRole value. No existing rows,
-- columns, or constraints are touched or reset.
--
-- The existing `users_shop_id_only_for_staff` CHECK constraint
-- (role = 'SHOP_STAFF' OR shop_id IS NULL), added in phase8_shop_staff,
-- already correctly forbids a shop_id on any non-SHOP_STAFF row - including
-- FACULTY - with no further change required.
ALTER TYPE "UserRole" ADD VALUE 'FACULTY';
