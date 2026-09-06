-- AlterTable
ALTER TABLE "users" ADD COLUMN     "shop_id" TEXT;

-- CreateIndex
CREATE INDEX "users_shop_id_idx" ON "users"("shop_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "print_shops"("shop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: only SHOP_STAFF rows may have a shop assignment - STUDENT
-- and ADMIN rows must keep shop_id NULL. This is a DB-level guarantee on
-- top of the application-level validation in staff.service.ts (which never
-- lets a client set shopId on anything but a SHOP_STAFF account).
ALTER TABLE "users" ADD CONSTRAINT "users_shop_id_only_for_staff" CHECK ("role" = 'SHOP_STAFF' OR "shop_id" IS NULL);
