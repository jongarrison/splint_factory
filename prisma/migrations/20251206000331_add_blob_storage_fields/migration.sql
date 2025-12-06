-- AlterTable
ALTER TABLE "GeometryProcessingQueue" ADD COLUMN "GeometryBlobPathname" TEXT;
ALTER TABLE "GeometryProcessingQueue" ADD COLUMN "GeometryBlobUrl" TEXT;
ALTER TABLE "GeometryProcessingQueue" ADD COLUMN "PrintBlobPathname" TEXT;
ALTER TABLE "GeometryProcessingQueue" ADD COLUMN "PrintBlobUrl" TEXT;
