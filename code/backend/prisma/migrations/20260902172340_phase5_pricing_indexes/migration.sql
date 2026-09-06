-- CreateIndex
CREATE INDEX "shop_finishing_rules_shop_id_finishing_type_idx" ON "shop_finishing_rules"("shop_id", "finishing_type");

-- CreateIndex
CREATE INDEX "shop_pricing_rules_shop_id_print_type_paper_size_sides_idx" ON "shop_pricing_rules"("shop_id", "print_type", "paper_size", "sides");
