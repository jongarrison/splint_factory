-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('SYSTEM_ADMIN', 'ORG_ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "organizationId" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'MEMBER',
    "invitedByUserId" TEXT,
    "invitationAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvitationLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "usedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitationLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NamedGeometry" (
    "id" TEXT NOT NULL,
    "GeometryName" TEXT NOT NULL,
    "GeometryAlgorithmName" TEXT NOT NULL,
    "GeometryInputParameterSchema" TEXT NOT NULL,
    "shortDescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "previewImage" BYTEA,
    "previewImageContentType" TEXT,
    "previewImageUpdatedAt" TIMESTAMP(3),
    "measurementImage" BYTEA,
    "measurementImageContentType" TEXT,
    "measurementImageUpdatedAt" TIMESTAMP(3),
    "CreatorID" TEXT NOT NULL,
    "CreationTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NamedGeometry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "permissions" TEXT NOT NULL,
    "organizationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GeometryProcessingQueue" (
    "id" TEXT NOT NULL,
    "GeometryID" TEXT NOT NULL,
    "CreatorID" TEXT NOT NULL,
    "OwningOrganizationID" TEXT NOT NULL,
    "CreationTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "GeometryInputParameterData" TEXT NOT NULL,
    "ProcessStartedTime" TIMESTAMP(3),
    "ProcessCompletedTime" TIMESTAMP(3),
    "isProcessSuccessful" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDebugRequest" BOOLEAN NOT NULL DEFAULT false,
    "CustomerNote" TEXT,
    "CustomerID" TEXT,
    "objectID" TEXT,
    "objectIDGeneratedAt" TIMESTAMP(3),
    "GeometryFileContents" BYTEA,
    "GeometryFileName" TEXT,
    "GeometryBlobUrl" TEXT,
    "GeometryBlobPathname" TEXT,
    "PrintFileContents" BYTEA,
    "PrintFileName" TEXT,
    "PrintBlobUrl" TEXT,
    "PrintBlobPathname" TEXT,
    "ProcessingLog" TEXT,

    CONSTRAINT "GeometryProcessingQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PrintQueue" (
    "id" TEXT NOT NULL,
    "GeometryProcessingQueueID" TEXT NOT NULL,
    "PrintStartedTime" TIMESTAMP(3),
    "PrintCompletedTime" TIMESTAMP(3),
    "isPrintSuccessful" BOOLEAN NOT NULL DEFAULT false,
    "printNote" TEXT,
    "printAcceptance" BOOLEAN,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "CreationTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" DOUBLE PRECISION,
    "progressLastReportTime" TIMESTAMP(3),
    "logs" TEXT,

    CONSTRAINT "PrintQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "public"."Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationLink_token_key" ON "public"."InvitationLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationLink_usedByUserId_key" ON "public"."InvitationLink"("usedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "NamedGeometry_GeometryName_key" ON "public"."NamedGeometry"("GeometryName");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "public"."ApiKey"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "GeometryProcessingQueue_objectID_key" ON "public"."GeometryProcessingQueue"("objectID");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvitationLink" ADD CONSTRAINT "InvitationLink_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvitationLink" ADD CONSTRAINT "InvitationLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvitationLink" ADD CONSTRAINT "InvitationLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NamedGeometry" ADD CONSTRAINT "NamedGeometry_CreatorID_fkey" FOREIGN KEY ("CreatorID") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApiKey" ADD CONSTRAINT "ApiKey_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GeometryProcessingQueue" ADD CONSTRAINT "GeometryProcessingQueue_OwningOrganizationID_fkey" FOREIGN KEY ("OwningOrganizationID") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GeometryProcessingQueue" ADD CONSTRAINT "GeometryProcessingQueue_CreatorID_fkey" FOREIGN KEY ("CreatorID") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GeometryProcessingQueue" ADD CONSTRAINT "GeometryProcessingQueue_GeometryID_fkey" FOREIGN KEY ("GeometryID") REFERENCES "public"."NamedGeometry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrintQueue" ADD CONSTRAINT "PrintQueue_GeometryProcessingQueueID_fkey" FOREIGN KEY ("GeometryProcessingQueueID") REFERENCES "public"."GeometryProcessingQueue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

