-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "googlePlaceId" TEXT;

-- CreateIndex
CREATE INDEX "Store_googlePlaceId_idx" ON "Store"("googlePlaceId");
