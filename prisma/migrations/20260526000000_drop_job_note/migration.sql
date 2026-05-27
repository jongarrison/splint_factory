-- Drop the no-longer-used jobNote column from DesignJob (mapped table: GeometryProcessingQueue).
ALTER TABLE "GeometryProcessingQueue" DROP COLUMN "jobNote";
