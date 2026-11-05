CREATE TYPE "PrintOutcome" AS ENUM ('SUCCEEDED', 'FAILED', 'OPERATOR_CANCELLED', 'AMBIGUOUS_STOP');

ALTER TABLE "PrintQueue"
ADD COLUMN "outcome" "PrintOutcome",
ADD COLUMN "failureEvidence" JSONB,
ADD COLUMN "replacementForPrintJobId" TEXT;

ALTER TABLE "AuditEvent"
ADD COLUMN "clientDeviceId" TEXT,
ADD COLUMN "printerSerial" TEXT,
ADD COLUMN "printJobId" TEXT;

CREATE UNIQUE INDEX "PrintQueue_replacementForPrintJobId_key"
ON "PrintQueue"("replacementForPrintJobId");

CREATE INDEX "AuditEvent_clientDeviceId_idx" ON "AuditEvent"("clientDeviceId");
CREATE INDEX "AuditEvent_printerSerial_idx" ON "AuditEvent"("printerSerial");
CREATE INDEX "AuditEvent_printJobId_idx" ON "AuditEvent"("printJobId");

ALTER TABLE "PrintQueue"
ADD CONSTRAINT "PrintQueue_replacementForPrintJobId_fkey"
FOREIGN KEY ("replacementForPrintJobId") REFERENCES "PrintQueue"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
