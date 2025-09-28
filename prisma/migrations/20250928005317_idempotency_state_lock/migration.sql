/*
  Warnings:

  - Added the required column `updatedAt` to the `Idempotency` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."IdemState" AS ENUM ('PENDING', 'COMPLETED');

-- AlterTable
ALTER TABLE "public"."Idempotency" ADD COLUMN     "state" "public"."IdemState" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "statusCode" DROP NOT NULL,
ALTER COLUMN "response" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Idempotency_state_createdAt_idx" ON "public"."Idempotency"("state", "createdAt");
