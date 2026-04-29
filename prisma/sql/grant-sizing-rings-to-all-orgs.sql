-- Make the Sizing Rings design visible to ALL existing organizations.
-- Idempotent: safe to re-run; ON CONFLICT skips rows that already exist.
--
-- Design ID must match src/designs/sizing-rings/definition.json.
-- Run after the design row exists in the DB (i.e. after seed.ts or sync-designs.js).
--
-- Local dev:
--   psql "$DATABASE_URL" -f prisma/sql/grant-sizing-rings-to-all-orgs.sql
-- Production: run via your usual psql access to the prod DB.

INSERT INTO "OrganizationGeometry" ("organizationId", "designId", "createdAt")
SELECT o.id, 'siz1ngr1ngs0apr2026vqx9k7w', NOW()
FROM "Organization" o
ON CONFLICT ("organizationId", "designId") DO NOTHING;
