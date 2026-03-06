-- DropForeignKey
ALTER TABLE "public"."ClientDevice" DROP CONSTRAINT "ClientDevice_organizationId_fkey";

-- AlterTable
ALTER TABLE "public"."ClientDevice" ALTER COLUMN "organizationId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."ClientDevice" ADD CONSTRAINT "ClientDevice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
