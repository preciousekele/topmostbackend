/*
  Warnings:

  - A unique constraint covering the columns `[branchId,date]` on the table `CompanyDailySummary` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[washerId,date,branchId]` on the table `DailySummary` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `branchId` to the `CarWash` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `CompanyDailySummary` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `DailySummary` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `branchId` to the `Washer` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CompanyDailySummary_date_key";

-- DropIndex
DROP INDEX "DailySummary_washerId_date_key";

-- AlterTable
ALTER TABLE "CarWash" ADD COLUMN     "branchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CompanyDailySummary" ADD COLUMN     "branchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DailySummary" ADD COLUMN     "branchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "branchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Washer" ADD COLUMN     "branchId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_code_idx" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_name_idx" ON "Branch"("name");

-- CreateIndex
CREATE INDEX "CarWash_branchId_idx" ON "CarWash"("branchId");

-- CreateIndex
CREATE INDEX "CompanyDailySummary_branchId_idx" ON "CompanyDailySummary"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDailySummary_branchId_date_key" ON "CompanyDailySummary"("branchId", "date");

-- CreateIndex
CREATE INDEX "DailySummary_branchId_idx" ON "DailySummary"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "DailySummary_washerId_date_branchId_key" ON "DailySummary"("washerId", "date", "branchId");

-- CreateIndex
CREATE INDEX "User_branchId_idx" ON "User"("branchId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Washer_branchId_idx" ON "Washer"("branchId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Washer" ADD CONSTRAINT "Washer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarWash" ADD CONSTRAINT "CarWash_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDailySummary" ADD CONSTRAINT "CompanyDailySummary_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
