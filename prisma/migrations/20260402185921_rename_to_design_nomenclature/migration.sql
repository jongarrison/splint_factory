-- Rename nomenclature: Geometry -> Design, GeometryProcessingQueue -> DesignJob, PrintQueue -> PrintJob
-- All ALTER TABLE RENAME COLUMN operations are metadata-only in PostgreSQL (instant, no data rewrite).
-- Table names are NOT renamed because Prisma @@map handles the mapping and renaming tables
-- would break existing migrations' references. Column renames are safe within mapped tables.

-- NamedGeometry table: rename columns
ALTER TABLE "NamedGeometry" RENAME COLUMN "GeometryName" TO "name";
ALTER TABLE "NamedGeometry" RENAME COLUMN "GeometryAlgorithmName" TO "algorithmName";
ALTER TABLE "NamedGeometry" RENAME COLUMN "GeometryInputParameterSchema" TO "inputParameterSchema";
ALTER TABLE "NamedGeometry" RENAME COLUMN "CreatorID" TO "creatorId";
ALTER TABLE "NamedGeometry" RENAME COLUMN "CreationTime" TO "createdAt";

-- OrganizationGeometry table: rename columns
ALTER TABLE "OrganizationGeometry" RENAME COLUMN "namedGeometryId" TO "designId";

-- GeometryProcessingQueue table: rename columns
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "GeometryID" TO "designId";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "CreatorID" TO "creatorId";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "OwningOrganizationID" TO "owningOrganizationId";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "CreationTime" TO "createdAt";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "GeometryInputParameterData" TO "inputParameters";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "ProcessStartedTime" TO "processStartedAt";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "ProcessCompletedTime" TO "processCompletedAt";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "JobNote" TO "jobNote";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "JobID" TO "jobLabel";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "objectID" TO "objectId";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "objectIDGeneratedAt" TO "objectIdGeneratedAt";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "GeometryFileContents" TO "meshFileContents";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "GeometryFileName" TO "meshFileName";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "GeometryBlobUrl" TO "meshBlobUrl";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "GeometryBlobPathname" TO "meshBlobPathname";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "PrintFileContents" TO "printFileContents";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "PrintFileName" TO "printFileName";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "PrintBlobUrl" TO "printBlobUrl";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "PrintBlobPathname" TO "printBlobPathname";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "ProcessingLog" TO "processingLog";
ALTER TABLE "GeometryProcessingQueue" RENAME COLUMN "MeshMetadata" TO "meshMetadata";

-- PrintQueue table: rename columns
ALTER TABLE "PrintQueue" RENAME COLUMN "GeometryProcessingQueueID" TO "designJobId";
ALTER TABLE "PrintQueue" RENAME COLUMN "PrintStartedTime" TO "printStartedAt";
ALTER TABLE "PrintQueue" RENAME COLUMN "PrintCompletedTime" TO "printCompletedAt";
ALTER TABLE "PrintQueue" RENAME COLUMN "CreationTime" TO "createdAt";
ALTER TABLE "PrintQueue" RENAME COLUMN "progressLastReportTime" TO "progressLastReportAt";

-- Rename foreign key constraints to match new column names
ALTER TABLE "GeometryProcessingQueue" RENAME CONSTRAINT "GeometryProcessingQueue_CreatorID_fkey" TO "GeometryProcessingQueue_creatorId_fkey";
ALTER TABLE "GeometryProcessingQueue" RENAME CONSTRAINT "GeometryProcessingQueue_GeometryID_fkey" TO "GeometryProcessingQueue_designId_fkey";
ALTER TABLE "GeometryProcessingQueue" RENAME CONSTRAINT "GeometryProcessingQueue_OwningOrganizationID_fkey" TO "GeometryProcessingQueue_owningOrganizationId_fkey";
ALTER TABLE "NamedGeometry" RENAME CONSTRAINT "NamedGeometry_CreatorID_fkey" TO "NamedGeometry_creatorId_fkey";
ALTER TABLE "OrganizationGeometry" RENAME CONSTRAINT "OrganizationGeometry_namedGeometryId_fkey" TO "OrganizationGeometry_designId_fkey";
ALTER TABLE "PrintQueue" RENAME CONSTRAINT "PrintQueue_GeometryProcessingQueueID_fkey" TO "PrintQueue_designJobId_fkey";

-- Rename indexes to match new column names
ALTER INDEX "GeometryProcessingQueue_objectID_key" RENAME TO "GeometryProcessingQueue_objectId_key";
ALTER INDEX "NamedGeometry_GeometryName_key" RENAME TO "NamedGeometry_name_key";