ALTER TABLE "InvitationLink"
ADD COLUMN "emailAcceptedAt" TIMESTAMP(3),
ADD COLUMN "emailProviderId" TEXT,
ADD COLUMN "emailLastError" TEXT;
