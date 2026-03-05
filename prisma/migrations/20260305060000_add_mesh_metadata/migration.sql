-- Add MeshMetadata column to store mesh analysis data from geometry processing
ALTER TABLE "GeometryProcessingQueue" ADD COLUMN "MeshMetadata" TEXT;
