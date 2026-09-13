/*
  Warnings:

  - You are about to drop the `CardRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CardRequest" DROP CONSTRAINT "CardRequest_businessId_fkey";

-- DropForeignKey
ALTER TABLE "CardRequest" DROP CONSTRAINT "CardRequest_processedById_fkey";

-- DropForeignKey
ALTER TABLE "CardRequest" DROP CONSTRAINT "CardRequest_requestedById_fkey";

-- DropForeignKey
ALTER TABLE "CardRequest" DROP CONSTRAINT "CardRequest_storeId_fkey";

-- DropTable
DROP TABLE "CardRequest";

-- DropEnum
DROP TYPE "CardRequestStatus";
