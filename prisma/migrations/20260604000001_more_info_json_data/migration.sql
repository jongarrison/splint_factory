-- Replace individual columns with a single JSON data blob.
-- Keep id, name, email, createdAt as queryable columns.

ALTER TABLE "MoreInfoRequest"
  DROP COLUMN "city",
  DROP COLUMN "stateProvince",
  DROP COLUMN "country",
  DROP COLUMN "phone",
  DROP COLUMN "organization",
  DROP COLUMN "medicalSpecialty",
  DROP COLUMN "interestedWaitlist",
  DROP COLUMN "interestedInfo",
  DROP COLUMN "interestedUpdates",
  ADD COLUMN "data" JSONB NOT NULL DEFAULT '{}';
