-- CreateTable
CREATE TABLE "public"."UserRegistrationAcknowledgment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acknowledgmentVersion" TEXT NOT NULL,
    "acknowledgmentText" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRegistrationAcknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRegistrationAcknowledgment_userId_idx" ON "public"."UserRegistrationAcknowledgment"("userId");

-- CreateIndex
CREATE INDEX "UserRegistrationAcknowledgment_acknowledgedAt_idx" ON "public"."UserRegistrationAcknowledgment"("acknowledgedAt");

-- AddForeignKey
ALTER TABLE "public"."UserRegistrationAcknowledgment" ADD CONSTRAINT "UserRegistrationAcknowledgment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
