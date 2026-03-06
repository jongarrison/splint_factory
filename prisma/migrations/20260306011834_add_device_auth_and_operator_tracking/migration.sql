-- AlterTable
ALTER TABLE "public"."PrintQueue" ADD COLUMN     "acceptedByUserId" TEXT,
ADD COLUMN     "printedByUserId" TEXT;

-- CreateTable
CREATE TABLE "public"."ClientDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "currentOperatorId" TEXT,
    "operatorValidatedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ClientAuthChallenge" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "authorizedByUserId" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "exchangeToken" TEXT,
    "exchangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientAuthChallenge_exchangeToken_key" ON "public"."ClientAuthChallenge"("exchangeToken");

-- CreateIndex
CREATE INDEX "ClientAuthChallenge_deviceId_idx" ON "public"."ClientAuthChallenge"("deviceId");

-- CreateIndex
CREATE INDEX "ClientAuthChallenge_exchangeToken_idx" ON "public"."ClientAuthChallenge"("exchangeToken");

-- AddForeignKey
ALTER TABLE "public"."PrintQueue" ADD CONSTRAINT "PrintQueue_printedByUserId_fkey" FOREIGN KEY ("printedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrintQueue" ADD CONSTRAINT "PrintQueue_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientDevice" ADD CONSTRAINT "ClientDevice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientDevice" ADD CONSTRAINT "ClientDevice_currentOperatorId_fkey" FOREIGN KEY ("currentOperatorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientAuthChallenge" ADD CONSTRAINT "ClientAuthChallenge_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."ClientDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClientAuthChallenge" ADD CONSTRAINT "ClientAuthChallenge_authorizedByUserId_fkey" FOREIGN KEY ("authorizedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
