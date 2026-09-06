-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'SHOP_STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PLACED', 'PAYMENT_CONFIRMED', 'QUEUED', 'PRINTING', 'READY', 'COLLECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrintType" AS ENUM ('BW', 'COLOR');

-- CreateEnum
CREATE TYPE "PaperSize" AS ENUM ('A4', 'A3', 'A5', 'LETTER', 'LEGAL');

-- CreateEnum
CREATE TYPE "Sides" AS ENUM ('SINGLE', 'DOUBLE');

-- CreateEnum
CREATE TYPE "FinishingType" AS ENUM ('SPIRAL_BINDING', 'HARD_BINDING', 'STAPLING', 'LAMINATION', 'NONE');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'PRINTING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'CARD', 'WALLET', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "documents" (
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "page_count" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "print_shops" (
    "shop_id" TEXT NOT NULL,
    "shop_code" TEXT NOT NULL,
    "shop_name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "accepting_orders" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_shops_pkey" PRIMARY KEY ("shop_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "order_id" TEXT NOT NULL,
    "order_code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "order_status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
    "total_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_reason" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "order_documents" (
    "order_document_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "pricing_rule_id" TEXT NOT NULL,
    "finishing_rule_id" TEXT,
    "copies" INTEGER NOT NULL,
    "print_page_count" INTEGER NOT NULL,
    "price_per_page" DECIMAL(10,2) NOT NULL,
    "finishing_price" DECIMAL(10,2) NOT NULL,
    "line_total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "order_documents_pkey" PRIMARY KEY ("order_document_id")
);

-- CreateTable
CREATE TABLE "shop_pricing_rules" (
    "pricing_rule_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "print_type" "PrintType" NOT NULL,
    "paper_size" "PaperSize" NOT NULL,
    "sides" "Sides" NOT NULL,
    "price_per_page" DECIMAL(10,2) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),

    CONSTRAINT "shop_pricing_rules_pkey" PRIMARY KEY ("pricing_rule_id")
);

-- CreateTable
CREATE TABLE "shop_finishing_rules" (
    "finishing_rule_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "finishing_type" "FinishingType" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),

    CONSTRAINT "shop_finishing_rules_pkey" PRIMARY KEY ("finishing_rule_id")
);

-- CreateTable
CREATE TABLE "queue" (
    "queue_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "queue_number" INTEGER NOT NULL,
    "queue_status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "queue_pkey" PRIMARY KEY ("queue_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "payment_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "refund_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "refund_amount" DECIMAL(10,2) NOT NULL,
    "refund_reason" TEXT NOT NULL,
    "refund_status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "refund_transaction_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("refund_id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "history_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "changed_by_user_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("history_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "documents_user_id_idx" ON "documents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "print_shops_shop_code_key" ON "print_shops"("shop_code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_code_key" ON "orders"("order_code");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_shop_id_idx" ON "orders"("shop_id");

-- CreateIndex
CREATE INDEX "orders_order_status_idx" ON "orders"("order_status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "order_documents_order_id_idx" ON "order_documents"("order_id");

-- CreateIndex
CREATE INDEX "order_documents_document_id_idx" ON "order_documents"("document_id");

-- CreateIndex
CREATE INDEX "order_documents_pricing_rule_id_idx" ON "order_documents"("pricing_rule_id");

-- CreateIndex
CREATE INDEX "order_documents_finishing_rule_id_idx" ON "order_documents"("finishing_rule_id");

-- CreateIndex
CREATE INDEX "shop_pricing_rules_shop_id_idx" ON "shop_pricing_rules"("shop_id");

-- CreateIndex
CREATE INDEX "shop_finishing_rules_shop_id_idx" ON "shop_finishing_rules"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "queue_order_id_key" ON "queue"("order_id");

-- CreateIndex
CREATE INDEX "queue_entered_at_idx" ON "queue"("entered_at");

-- CreateIndex
CREATE INDEX "queue_queue_status_idx" ON "queue"("queue_status");

-- CreateIndex
CREATE INDEX "queue_queue_status_entered_at_idx" ON "queue"("queue_status", "entered_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_id_key" ON "payments"("transaction_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_transaction_id_idx" ON "payments"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_refund_transaction_id_key" ON "refunds"("refund_transaction_id");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_idx" ON "order_status_history"("order_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "print_shops"("shop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_pricing_rule_id_fkey" FOREIGN KEY ("pricing_rule_id") REFERENCES "shop_pricing_rules"("pricing_rule_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_finishing_rule_id_fkey" FOREIGN KEY ("finishing_rule_id") REFERENCES "shop_finishing_rules"("finishing_rule_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_pricing_rules" ADD CONSTRAINT "shop_pricing_rules_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "print_shops"("shop_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_finishing_rules" ADD CONSTRAINT "shop_finishing_rules_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "print_shops"("shop_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue" ADD CONSTRAINT "queue_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("payment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
