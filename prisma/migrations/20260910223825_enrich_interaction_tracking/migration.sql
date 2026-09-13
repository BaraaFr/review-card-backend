-- CreateEnum
CREATE TYPE "InteractionDeviceType" AS ENUM ('MOBILE', 'TABLET', 'DESKTOP', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "deviceType" "InteractionDeviceType" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isReturning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "operatingSystem" TEXT,
ADD COLUMN     "visitorKey" TEXT;

-- CreateIndex
CREATE INDEX "Interaction_visitorKey_createdAt_idx" ON "Interaction"("visitorKey", "createdAt");

-- CreateIndex
CREATE INDEX "Interaction_cardId_visitorKey_createdAt_idx" ON "Interaction"("cardId", "visitorKey", "createdAt");

-- CreateIndex
CREATE INDEX "Interaction_isDuplicate_isBot_createdAt_idx" ON "Interaction"("isDuplicate", "isBot", "createdAt");
