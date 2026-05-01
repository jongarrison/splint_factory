-- AlterTable
ALTER TABLE "public"."User"
ADD COLUMN "siteAlertOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."ProcessorHeartbeat" (
    "id" TEXT NOT NULL,
    "lastPingAt" TIMESTAMP(3),
    "offlineSince" TIMESTAMP(3),
    "lastOfflineAlertSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessorHeartbeat_pkey" PRIMARY KEY ("id")
);

-- Seed singleton heartbeat row
INSERT INTO "public"."ProcessorHeartbeat" ("id", "createdAt", "updatedAt")
VALUES ('geo_processor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Backfill initial site admin notification recipient
UPDATE "public"."User"
SET "siteAlertOptIn" = true
WHERE LOWER("email") = LOWER('jon@splintfactory.com')
  AND "role" = 'SYSTEM_ADMIN'::"public"."UserRole";