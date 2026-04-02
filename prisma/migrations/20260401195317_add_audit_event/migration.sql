-- CreateTable
CREATE TABLE "public"."AuditEvent" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "actorId" TEXT,
    "targetUserId" TEXT,
    "organizationId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_idx" ON "public"."AuditEvent"("eventType");

-- CreateIndex
CREATE INDEX "AuditEvent_channel_idx" ON "public"."AuditEvent"("channel");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_idx" ON "public"."AuditEvent"("actorId");

-- CreateIndex
CREATE INDEX "AuditEvent_targetUserId_idx" ON "public"."AuditEvent"("targetUserId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_idx" ON "public"."AuditEvent"("organizationId");

-- CreateIndex
CREATE INDEX "AuditEvent_timestamp_idx" ON "public"."AuditEvent"("timestamp");

-- AddForeignKey
ALTER TABLE "public"."AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditEvent" ADD CONSTRAINT "AuditEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
