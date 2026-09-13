-- CreateEnum
CREATE TYPE "AccountRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'CLOSED');

-- CreateTable
CREATE TABLE "AccountRequest" (
    "id" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "businessType" TEXT,
    "requestedCards" INTEGER NOT NULL,
    "message" TEXT,
    "status" "AccountRequestStatus" NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "handledById" TEXT,
    "contactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountRequest_status_createdAt_idx" ON "AccountRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AccountRequest_phone_idx" ON "AccountRequest"("phone");

-- CreateIndex
CREATE INDEX "AccountRequest_shopName_idx" ON "AccountRequest"("shopName");
