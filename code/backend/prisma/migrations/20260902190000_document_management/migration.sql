-- Phase 3: Document Management
--
-- The `documents` table pre-Phase-3 only ever held placeholder/dev-seed
-- metadata (fake file_url values, no real files ever existed on disk for
-- them - see prisma/seed.ts before this migration). Real documents now
-- require storage_key/file_type/mime_type/file_size/file_hash, none of
-- which those placeholder rows have. They are cleared here rather than
-- backfilled with fabricated values, since no real backing file exists for
-- them to reference. This does not affect Users, PrintShops, or any other
-- table - no real user-facing data is lost.
DELETE FROM "documents";

-- CreateEnum
CREATE TYPE "DocumentFileType" AS ENUM ('PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX', 'JPG', 'PNG');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "file_hash" TEXT NOT NULL,
ADD COLUMN     "file_size" INTEGER NOT NULL,
ADD COLUMN     "file_type" "DocumentFileType" NOT NULL,
ADD COLUMN     "mime_type" TEXT NOT NULL,
ADD COLUMN     "storage_key" TEXT NOT NULL,
ALTER COLUMN "page_count" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_file_hash_idx" ON "documents"("file_hash");
