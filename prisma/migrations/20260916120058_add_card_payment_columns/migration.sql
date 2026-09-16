-- CreateEnum
CREATE TYPE "CardPaymentMethod" AS ENUM ('CASH', 'WHISH', 'OTHER');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "trialStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" "CardPaymentMethod",
ADD COLUMN     "salePriceCents" INTEGER;

-- CreateIndex
CREATE INDEX "Card_paidAt_idx" ON "Card"("paidAt");

-- CreateIndex
CREATE INDEX "Card_deliveredAt_idx" ON "Card"("deliveredAt");
