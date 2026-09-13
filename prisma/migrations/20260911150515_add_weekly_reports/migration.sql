-- CreateEnum
CREATE TYPE "WeeklyReportDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "WeeklyReportDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "WeeklyReportDeliveryKind" AS ENUM ('WEEKLY', 'TEST');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "weeklyReportDay" "WeeklyReportDay" NOT NULL DEFAULT 'MONDAY',
ADD COLUMN     "weeklyReportEmail" TEXT,
ADD COLUMN     "weeklyReportEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "weeklyReportLastSentAt" TIMESTAMP(3),
ADD COLUMN     "weeklyReportTime" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN     "weeklyReportTimeZone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "WeeklyReportDelivery" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "WeeklyReportDeliveryKind" NOT NULL DEFAULT 'WEEKLY',
    "scheduleKey" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "WeeklyReportDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReportDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyReportDelivery_businessId_status_idx" ON "WeeklyReportDelivery"("businessId", "status");

-- CreateIndex
CREATE INDEX "WeeklyReportDelivery_createdAt_idx" ON "WeeklyReportDelivery"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReportDelivery_businessId_scheduleKey_key" ON "WeeklyReportDelivery"("businessId", "scheduleKey");

-- AddForeignKey
ALTER TABLE "WeeklyReportDelivery" ADD CONSTRAINT "WeeklyReportDelivery_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
