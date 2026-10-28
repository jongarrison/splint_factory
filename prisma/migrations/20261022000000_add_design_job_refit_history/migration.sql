-- Track design revisions and preserve the inputs used by each print.
ALTER TABLE "public"."GeometryProcessingQueue"
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "public"."PrintQueue"
ADD COLUMN "designRevision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "inputParametersSnapshot" TEXT,
ADD COLUMN "printPreparationStartedAt" TIMESTAMP(3);

UPDATE "public"."PrintQueue" AS print
SET "inputParametersSnapshot" = design."inputParameters"
FROM "public"."GeometryProcessingQueue" AS design
WHERE print."designJobId" = design."id";

-- Give audit events a queryable association with their design job.
ALTER TABLE "public"."AuditEvent"
ADD COLUMN "designJobId" TEXT;

UPDATE "public"."AuditEvent" AS event
SET "designJobId" = event."metadata"->>'designJobId'
WHERE event."metadata"->>'designJobId' IS NOT NULL
AND EXISTS (
	SELECT 1
	FROM "public"."GeometryProcessingQueue" AS design
	WHERE design."id" = event."metadata"->>'designJobId'
);

CREATE INDEX "AuditEvent_designJobId_idx"
ON "public"."AuditEvent"("designJobId");

ALTER TABLE "public"."AuditEvent"
ADD CONSTRAINT "AuditEvent_designJobId_fkey"
FOREIGN KEY ("designJobId") REFERENCES "public"."GeometryProcessingQueue"("id")
ON DELETE SET NULL ON UPDATE CASCADE;