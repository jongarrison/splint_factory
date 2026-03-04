-- CreateTable
CREATE TABLE "public"."OrganizationGeometry" (
    "organizationId" TEXT NOT NULL,
    "namedGeometryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationGeometry_pkey" PRIMARY KEY ("organizationId","namedGeometryId")
);

-- AddForeignKey
ALTER TABLE "public"."OrganizationGeometry" ADD CONSTRAINT "OrganizationGeometry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationGeometry" ADD CONSTRAINT "OrganizationGeometry_namedGeometryId_fkey" FOREIGN KEY ("namedGeometryId") REFERENCES "public"."NamedGeometry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
