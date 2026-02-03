-- CreateEnum
CREATE TYPE "public"."LinkType" AS ENUM ('EXTERNAL_URL', 'HOSTED_FILE');

-- CreateTable
CREATE TABLE "public"."Link" (
    "id" TEXT NOT NULL,
    "shortcode" TEXT NOT NULL,
    "linkType" "public"."LinkType" NOT NULL,
    "linkTarget" TEXT NOT NULL,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LinkActivity" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "visitTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Link_shortcode_key" ON "public"."Link"("shortcode");

-- CreateIndex
CREATE INDEX "Link_shortcode_idx" ON "public"."Link"("shortcode");

-- CreateIndex
CREATE INDEX "LinkActivity_linkId_idx" ON "public"."LinkActivity"("linkId");

-- CreateIndex
CREATE INDEX "LinkActivity_visitTime_idx" ON "public"."LinkActivity"("visitTime");

-- AddForeignKey
ALTER TABLE "public"."Link" ADD CONSTRAINT "Link_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LinkActivity" ADD CONSTRAINT "LinkActivity_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "public"."Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;
