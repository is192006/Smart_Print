-- Replaces the plain lookup indexes from phase5_pricing_indexes with unique
-- constraints on the same (plus effectiveFrom) columns. This does not
-- restrict legitimate repricing over time (different effectiveFrom values
-- for the same shop/combination remain fully allowed - see
-- pricing.service.ts's overlap-prevention logic and its passing tests) - it
-- only makes an exact duplicate row (e.g. from re-running a
-- non-idempotent seed) impossible at the database level.
--
-- The database has already been manually deduplicated of pre-existing
-- duplicate rows before this migration was written, so this can apply
-- cleanly with no data loss.

DROP INDEX "shop_pricing_rules_shop_id_print_type_paper_size_sides_idx";
DROP INDEX "shop_finishing_rules_shop_id_finishing_type_idx";

CREATE UNIQUE INDEX "shop_pricing_rules_shop_id_print_type_paper_size_sides_ef_key" ON "shop_pricing_rules"("shop_id", "print_type", "paper_size", "sides", "effective_from");

CREATE UNIQUE INDEX "shop_finishing_rules_shop_id_finishing_type_effective_from_key" ON "shop_finishing_rules"("shop_id", "finishing_type", "effective_from");
