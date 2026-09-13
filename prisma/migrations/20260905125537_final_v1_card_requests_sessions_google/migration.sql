-- CreateEnum
CREATE TYPE "CardRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'FULFILLED', 'REJECTED', 'CANCELED');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "googlePlaceConnectedAt" TIMESTAMP(3),
ADD COLUMN     "googlePlaceConnectedFromUrl" TEXT;

-- CreateTable
CREATE TABLE "CardRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "status" "CardRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "processedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardRequest_businessId_status_idx" ON "CardRequest"("businessId", "status");

-- CreateIndex
CREATE INDEX "CardRequest_storeId_status_idx" ON "CardRequest"("storeId", "status");

-- CreateIndex
CREATE INDEX "CardRequest_requestedById_idx" ON "CardRequest"("requestedById");

-- CreateIndex
CREATE INDEX "CardRequest_createdAt_idx" ON "CardRequest"("createdAt");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_revokedAt_idx" ON "AuthSession"("revokedAt");

-- AddForeignKey
ALTER TABLE "CardRequest" ADD CONSTRAINT "CardRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardRequest" ADD CONSTRAINT "CardRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardRequest" ADD CONSTRAINT "CardRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardRequest" ADD CONSTRAINT "CardRequest_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
