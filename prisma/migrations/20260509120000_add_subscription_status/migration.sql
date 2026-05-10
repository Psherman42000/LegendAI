-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED', 'PAUSED');

-- AlterTable: add status column with default PENDING
ALTER TABLE "subscriptions" ADD COLUMN "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable: add cancelledAt column
ALTER TABLE "subscriptions" ADD COLUMN "cancelledAt" TIMESTAMP(3);