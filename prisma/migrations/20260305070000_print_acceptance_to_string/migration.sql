-- Add a temporary text column
ALTER TABLE "PrintQueue" ADD COLUMN "printAcceptance_new" TEXT;

-- Migrate existing boolean data to string values
UPDATE "PrintQueue" SET "printAcceptance_new" = 'ACCEPTED' WHERE "printAcceptance" = true;
UPDATE "PrintQueue" SET "printAcceptance_new" = 'REJECTED' WHERE "printAcceptance" = false;

-- Drop the old boolean column
ALTER TABLE "PrintQueue" DROP COLUMN "printAcceptance";

-- Rename the new column
ALTER TABLE "PrintQueue" RENAME COLUMN "printAcceptance_new" TO "printAcceptance";
