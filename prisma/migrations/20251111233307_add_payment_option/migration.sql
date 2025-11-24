-- AlterTable
ALTER TABLE "CarWash" ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "CarWash_paymentMethod_idx" ON "CarWash"("paymentMethod");
