-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Washer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Washer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarWash" (
    "id" TEXT NOT NULL,
    "carNumber" TEXT,
    "carModel" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "washDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarWash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WashedItem" (
    "id" TEXT NOT NULL,
    "carWashId" TEXT NOT NULL,
    "washerId" TEXT NOT NULL,
    "serviceItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WashedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySummary" (
    "id" TEXT NOT NULL,
    "washerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalCarsWashed" INTEGER NOT NULL DEFAULT 0,
    "totalItemsWashed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDailySummary" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalCarsWashed" INTEGER NOT NULL DEFAULT 0,
    "totalItemsWashed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CarWashToWasher" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CarWashToWasher_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Washer_name_idx" ON "Washer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceItem_name_key" ON "ServiceItem"("name");

-- CreateIndex
CREATE INDEX "ServiceItem_name_idx" ON "ServiceItem"("name");

-- CreateIndex
CREATE INDEX "CarWash_washDate_idx" ON "CarWash"("washDate");

-- CreateIndex
CREATE INDEX "CarWash_createdAt_idx" ON "CarWash"("createdAt");

-- CreateIndex
CREATE INDEX "WashedItem_carWashId_idx" ON "WashedItem"("carWashId");

-- CreateIndex
CREATE INDEX "WashedItem_washerId_idx" ON "WashedItem"("washerId");

-- CreateIndex
CREATE INDEX "WashedItem_serviceItemId_idx" ON "WashedItem"("serviceItemId");

-- CreateIndex
CREATE INDEX "WashedItem_createdAt_idx" ON "WashedItem"("createdAt");

-- CreateIndex
CREATE INDEX "DailySummary_date_idx" ON "DailySummary"("date");

-- CreateIndex
CREATE INDEX "DailySummary_washerId_idx" ON "DailySummary"("washerId");

-- CreateIndex
CREATE UNIQUE INDEX "DailySummary_washerId_date_key" ON "DailySummary"("washerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDailySummary_date_key" ON "CompanyDailySummary"("date");

-- CreateIndex
CREATE INDEX "CompanyDailySummary_date_idx" ON "CompanyDailySummary"("date");

-- CreateIndex
CREATE INDEX "_CarWashToWasher_B_index" ON "_CarWashToWasher"("B");

-- AddForeignKey
ALTER TABLE "WashedItem" ADD CONSTRAINT "WashedItem_carWashId_fkey" FOREIGN KEY ("carWashId") REFERENCES "CarWash"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashedItem" ADD CONSTRAINT "WashedItem_washerId_fkey" FOREIGN KEY ("washerId") REFERENCES "Washer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashedItem" ADD CONSTRAINT "WashedItem_serviceItemId_fkey" FOREIGN KEY ("serviceItemId") REFERENCES "ServiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_washerId_fkey" FOREIGN KEY ("washerId") REFERENCES "Washer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CarWashToWasher" ADD CONSTRAINT "_CarWashToWasher_A_fkey" FOREIGN KEY ("A") REFERENCES "CarWash"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CarWashToWasher" ADD CONSTRAINT "_CarWashToWasher_B_fkey" FOREIGN KEY ("B") REFERENCES "Washer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
