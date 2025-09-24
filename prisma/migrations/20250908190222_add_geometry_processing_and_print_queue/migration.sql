-- CreateTable
CREATE TABLE "GeometryProcessingQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "GeometryID" TEXT NOT NULL,
    "CreatorID" TEXT NOT NULL,
    "OwningOrganizationID" TEXT NOT NULL,
    "CreationTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "GeometryInputParameterData" TEXT NOT NULL,
    "ProcessStartedTime" DATETIME,
    "ProcessCompletedTime" DATETIME,
    "isProcessSuccessful" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "CustomerNote" TEXT,
    "CustomerID" TEXT,
    CONSTRAINT "GeometryProcessingQueue_GeometryID_fkey" FOREIGN KEY ("GeometryID") REFERENCES "NamedGeometry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GeometryProcessingQueue_CreatorID_fkey" FOREIGN KEY ("CreatorID") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GeometryProcessingQueue_OwningOrganizationID_fkey" FOREIGN KEY ("OwningOrganizationID") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrintQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "GeometryProcessingQueueID" TEXT NOT NULL,
    "GeometryFileContents" BLOB,
    "GeometryFileName" TEXT,
    "PrintFileContents" BLOB,
    "PrintFileName" TEXT,
    "PrintStartedTime" DATETIME,
    "PrintCompletedTime" DATETIME,
    "isPrintSuccessful" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PrintQueue_GeometryProcessingQueueID_fkey" FOREIGN KEY ("GeometryProcessingQueueID") REFERENCES "GeometryProcessingQueue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
