/*
  Warnings:

  - You are about to drop the column `GeometryFileContents` on the `PrintQueue` table. All the data in the column will be lost.
  - You are about to drop the column `GeometryFileName` on the `PrintQueue` table. All the data in the column will be lost.
  - You are about to drop the column `PrintFileContents` on the `PrintQueue` table. All the data in the column will be lost.
  - You are about to drop the column `PrintFileName` on the `PrintQueue` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GeometryProcessingQueue" ADD COLUMN "GeometryFileContents" BLOB;
ALTER TABLE "GeometryProcessingQueue" ADD COLUMN "GeometryFileName" TEXT;
ALTER TABLE "GeometryProcessingQueue" ADD COLUMN "PrintFileContents" BLOB;
ALTER TABLE "GeometryProcessingQueue" ADD COLUMN "PrintFileName" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PrintQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "GeometryProcessingQueueID" TEXT NOT NULL,
    "PrintStartedTime" DATETIME,
    "PrintCompletedTime" DATETIME,
    "isPrintSuccessful" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PrintQueue_GeometryProcessingQueueID_fkey" FOREIGN KEY ("GeometryProcessingQueueID") REFERENCES "GeometryProcessingQueue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PrintQueue" ("GeometryProcessingQueueID", "PrintCompletedTime", "PrintStartedTime", "id", "isPrintSuccessful") SELECT "GeometryProcessingQueueID", "PrintCompletedTime", "PrintStartedTime", "id", "isPrintSuccessful" FROM "PrintQueue";
DROP TABLE "PrintQueue";
ALTER TABLE "new_PrintQueue" RENAME TO "PrintQueue";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
