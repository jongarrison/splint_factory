-- CreateTable
CREATE TABLE "MoreInfoRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "stateProvince" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "organization" TEXT NOT NULL,
    "medicalSpecialty" TEXT NOT NULL,
    "interestedWaitlist" BOOLEAN NOT NULL DEFAULT false,
    "interestedInfo" BOOLEAN NOT NULL DEFAULT false,
    "interestedUpdates" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoreInfoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoreInfoRequest_email_idx" ON "MoreInfoRequest"("email");

-- CreateIndex
CREATE INDEX "MoreInfoRequest_createdAt_idx" ON "MoreInfoRequest"("createdAt");
