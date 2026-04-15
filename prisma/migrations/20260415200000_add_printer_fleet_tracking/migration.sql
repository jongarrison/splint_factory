-- AlterTable
ALTER TABLE "public"."PrintQueue" ADD COLUMN     "printerSerial" TEXT;

-- CreateTable
CREATE TABLE "public"."Printer" (
    "serial" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "name" TEXT,
    "deviceId" TEXT,
    "lastSnapshotAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Printer_pkey" PRIMARY KEY ("serial")
);

-- CreateTable
CREATE TABLE "public"."PrinterSnapshot" (
    "id" TEXT NOT NULL,
    "printerSerial" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "firmware" TEXT NOT NULL,
    "modules" JSONB,
    "amsConfig" JSONB,
    "networkIp" TEXT,
    "activeHmsErrors" JSONB,
    "funField" TEXT,
    "rawReport" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrinterSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrinterSnapshot_printerSerial_capturedAt_idx" ON "public"."PrinterSnapshot"("printerSerial", "capturedAt");

-- AddForeignKey
ALTER TABLE "public"."PrintQueue" ADD CONSTRAINT "PrintQueue_printerSerial_fkey" FOREIGN KEY ("printerSerial") REFERENCES "public"."Printer"("serial") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Printer" ADD CONSTRAINT "Printer_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."ClientDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrinterSnapshot" ADD CONSTRAINT "PrinterSnapshot_printerSerial_fkey" FOREIGN KEY ("printerSerial") REFERENCES "public"."Printer"("serial") ON DELETE RESTRICT ON UPDATE CASCADE;
