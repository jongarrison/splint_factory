ALTER TABLE "AuditEvent"
ADD COLUMN "eventKey" TEXT;

CREATE UNIQUE INDEX "AuditEvent_eventKey_key" ON "AuditEvent"("eventKey");
