-- AlterTable
ALTER TABLE "public"."MoreInfoRequest" ALTER COLUMN "data" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."ProcessorHeartbeat" ALTER COLUMN "id" SET DEFAULT 'geo_processor';

-- CreateTable
CREATE TABLE "public"."PrintJobPhoto" (
    "id" TEXT NOT NULL,
    "printJobId" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "photoPathname" TEXT,
    "progress" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintJobPhoto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."PrintJobPhoto" ADD CONSTRAINT "PrintJobPhoto_printJobId_fkey" FOREIGN KEY ("printJobId") REFERENCES "public"."PrintQueue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
