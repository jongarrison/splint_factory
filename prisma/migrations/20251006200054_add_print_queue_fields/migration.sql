-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PrintQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "GeometryProcessingQueueID" TEXT NOT NULL,
    "PrintStartedTime" DATETIME,
    "PrintCompletedTime" DATETIME,
    "isPrintSuccessful" BOOLEAN NOT NULL DEFAULT false,
    "printNote" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "CreationTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrintQueue_GeometryProcessingQueueID_fkey" FOREIGN KEY ("GeometryProcessingQueueID") REFERENCES "GeometryProcessingQueue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PrintQueue" ("GeometryProcessingQueueID", "PrintCompletedTime", "PrintStartedTime", "id", "isPrintSuccessful") SELECT "GeometryProcessingQueueID", "PrintCompletedTime", "PrintStartedTime", "id", "isPrintSuccessful" FROM "PrintQueue";
DROP TABLE "PrintQueue";
ALTER TABLE "new_PrintQueue" RENAME TO "PrintQueue";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
