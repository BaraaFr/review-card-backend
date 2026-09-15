-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "expiryReminderFor" TIMESTAMP(3),
ADD COLUMN     "expiryReminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Subscription_expiresAt_idx" ON "Subscription"("expiresAt");
