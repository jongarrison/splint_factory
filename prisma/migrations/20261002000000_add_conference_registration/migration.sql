ALTER TABLE "public"."User"
ADD COLUMN "emailVerificationGraceExpiresAt" TIMESTAMP(3);

ALTER TABLE "public"."SystemSettings"
ADD COLUMN "conferenceRegistrationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "conferenceOrganizationId" TEXT;

CREATE TABLE "public"."ConferenceLoginToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConferenceLoginToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."ConferenceAccessRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "registrationEnabled" BOOLEAN NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConferenceAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConferenceLoginToken_token_key" ON "public"."ConferenceLoginToken"("token");
CREATE INDEX "ConferenceLoginToken_userId_idx" ON "public"."ConferenceLoginToken"("userId");
CREATE INDEX "ConferenceLoginToken_expiresAt_idx" ON "public"."ConferenceLoginToken"("expiresAt");
CREATE INDEX "ConferenceAccessRequest_email_idx" ON "public"."ConferenceAccessRequest"("email");
CREATE INDEX "ConferenceAccessRequest_createdAt_idx" ON "public"."ConferenceAccessRequest"("createdAt");

ALTER TABLE "public"."SystemSettings"
ADD CONSTRAINT "SystemSettings_conferenceOrganizationId_fkey"
FOREIGN KEY ("conferenceOrganizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."ConferenceLoginToken"
ADD CONSTRAINT "ConferenceLoginToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;