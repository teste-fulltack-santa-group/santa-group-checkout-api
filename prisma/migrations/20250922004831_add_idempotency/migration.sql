/*
  Warnings:

  - A unique constraint covering the columns `[token]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[txid]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Payment_token_key" ON "public"."Payment"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_txid_key" ON "public"."Payment"("txid");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "public"."Payment"("createdAt");
