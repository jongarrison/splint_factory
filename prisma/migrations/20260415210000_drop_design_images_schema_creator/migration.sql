-- Design-as-Code migration: move inputParameterSchema, images, and creator tracking to code registry
-- These columns are now served from src/designs/*/definition.json and public/designs/*/

-- DropForeignKey
ALTER TABLE "public"."NamedGeometry" DROP CONSTRAINT "NamedGeometry_creatorId_fkey";

-- AlterTable
ALTER TABLE "public"."NamedGeometry" DROP COLUMN "creatorId",
DROP COLUMN "inputParameterSchema",
DROP COLUMN "measurementImage",
DROP COLUMN "measurementImageContentType",
DROP COLUMN "measurementImageUpdatedAt",
DROP COLUMN "previewImage",
DROP COLUMN "previewImageContentType",
DROP COLUMN "previewImageUpdatedAt";
