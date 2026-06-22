-- Lease cutoff for the keep-warm signal:
-- splint_geo_processor keeps Rhino running while now < warmUntil.
ALTER TABLE "public"."ProcessorHeartbeat"
ADD COLUMN "warmUntil" TIMESTAMP(3);
