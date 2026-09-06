-- Phase 4: Order Creation & Order Management
--
-- Both new columns are nullable and additive - no existing rows are
-- affected and no data is lost. printType/paperSize/sides are deliberately
-- NOT added here: they are already fully represented by the referenced
-- ShopPricingRule (order.service.ts resolves the correct rule from the
-- requested printType/paperSize/sides at order-creation time), so adding
-- them again on order_documents would duplicate data already captured.
ALTER TABLE "order_documents" ADD COLUMN     "page_range" TEXT,
ADD COLUMN     "special_instructions" TEXT;
