-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NamedGeometry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "GeometryName" TEXT NOT NULL,
    "GeometryAlgorithmName" TEXT NOT NULL,
    "GeometryInputParameterSchema" TEXT NOT NULL,
    "shortDescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "previewImage" BLOB,
    "previewImageContentType" TEXT,
    "previewImageUpdatedAt" DATETIME,
    "measurementImage" BLOB,
    "measurementImageContentType" TEXT,
    "measurementImageUpdatedAt" DATETIME,
    "CreatorID" TEXT NOT NULL,
    "CreationTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NamedGeometry_CreatorID_fkey" FOREIGN KEY ("CreatorID") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_NamedGeometry" ("CreationTime", "CreatorID", "GeometryAlgorithmName", "GeometryInputParameterSchema", "GeometryName", "id") SELECT "CreationTime", "CreatorID", "GeometryAlgorithmName", "GeometryInputParameterSchema", "GeometryName", "id" FROM "NamedGeometry";
DROP TABLE "NamedGeometry";
ALTER TABLE "new_NamedGeometry" RENAME TO "NamedGeometry";
CREATE UNIQUE INDEX "NamedGeometry_GeometryName_key" ON "NamedGeometry"("GeometryName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
