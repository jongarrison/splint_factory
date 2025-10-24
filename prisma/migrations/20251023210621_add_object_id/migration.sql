/*
  Warnings:

  - A unique constraint covering the columns `[objectID]` on the table `GeometryProcessingQueue` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GeometryProcessingQueue" ADD COLUMN "objectID" TEXT;
ALTER TABLE "GeometryProcessingQueue" ADD COLUMN "objectIDGeneratedAt" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "GeometryProcessingQueue_objectID_key" ON "GeometryProcessingQueue"("objectID");
