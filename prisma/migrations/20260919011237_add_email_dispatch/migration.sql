-- CreateEnum
CREATE TYPE "EmailDispatchStatus" AS ENUM ('PROCESSING', 'SENT', 'UNKNOWN');

-- CreateTable
CREATE TABLE "EmailDispatch" (
    "id" TEXT NOT NULL,
    "dispatchKey" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "messageId" TEXT,
    "status" "EmailDispatchStatus" NOT NULL DEFAULT 'PROCESSING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "uncertainAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailDispatch_dispatchKey_key" ON "EmailDispatch"("dispatchKey");

-- CreateIndex
CREATE INDEX "EmailDispatch_status_updatedAt_idx" ON "EmailDispatch"("status", "updatedAt");
