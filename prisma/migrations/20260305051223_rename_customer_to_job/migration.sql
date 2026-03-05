-- Rename CustomerNote -> JobNote and CustomerID -> JobID (preserve existing data)
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "CustomerNote" TO "JobNote";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "CustomerID" TO "JobID";
