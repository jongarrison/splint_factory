# Naming Refactor + UX Streamlining Tracker
**Date:** 2026-04-02
**Status:** In Progress

## Goals
1. Rename user-facing and code-level nomenclature for consistency ("Design" + "DesignJob" + "PrintJob")
2. Remove the geometry type selector on the new job page (already selected from menu)
3. Kill the progress modal; redirect to job detail page with inline progress
4. Move STL viewer to top of job detail page with status banner

## Migration Strategy
PostgreSQL rename migration (data-preserving):
1. Update schema.prisma with new names + @@map/@map pointing to old DB names
2. Create empty migration with `prisma migrate dev --create-only`
3. Write ALTER TABLE RENAME TO / ALTER TABLE RENAME COLUMN SQL
4. Run migration
5. Remove @@map/@map annotations (DB names now match Prisma names)

All renames are metadata-only operations in PostgreSQL -- instant, no data rewrite.

## Execution Order
- [x] Step 0: Create this tracking document
- [ ] Step 1: Prisma schema rename + fresh migration
- [ ] Step 2: API route renames (file/folder moves in Next.js app router)
- [ ] Step 3: Page route renames (file/folder moves)
- [ ] Step 4: Component updates (UI changes, kill modal, update job details page)
- [ ] Step 5: Nav/label updates (menu text, page headers)
- [ ] Step 6: splint_geo_processor updates (API URLs, field names in payloads)
- [ ] Step 7: splint_client updates (hardcoded URLs, variable names)
- [ ] Step 8: Dead code cleanup
- [ ] Step 9: Build/type-check all projects

---

## Prisma Model Renames

| Old Model Name             | New Model Name       | DB Table (fresh) |
|----------------------------|----------------------|-------------------|
| NamedGeometry              | Design               | Design            |
| GeometryProcessingQueue    | DesignJob            | DesignJob         |
| PrintQueue                 | PrintJob             | PrintJob          |
| OrganizationGeometry       | OrganizationDesign   | OrganizationDesign|

## Field Renames: Design (was NamedGeometry)

| Old Field                       | New Field              | Notes                    |
|---------------------------------|------------------------|--------------------------|
| GeometryName                    | name                   | @unique stays            |
| GeometryAlgorithmName           | algorithmName          |                          |
| GeometryInputParameterSchema    | inputParameterSchema   |                          |
| CreatorID                       | creatorId              | Normalize casing         |
| CreationTime                    | createdAt              | Standard convention      |
| geometryJobs (relation)         | designJobs (relation)  |                          |
| organizations (relation)        | organizations (relation)| Keep - already good     |
| shortDescription                | shortDescription       | Keep                     |
| isActive                        | isActive               | Keep                     |
| previewImage, etc.              | (keep as-is)           | Image fields fine        |

## Field Renames: DesignJob (was GeometryProcessingQueue)

| Old Field                    | New Field            | Notes                         |
|------------------------------|----------------------|-------------------------------|
| GeometryID                   | designId             | FK to Design                  |
| CreatorID                    | creatorId            | Normalize casing              |
| OwningOrganizationID         | owningOrganizationId | Normalize casing              |
| CreationTime                 | createdAt            | Standard convention           |
| GeometryInputParameterData   | inputParameters      |                               |
| ProcessStartedTime           | processStartedAt     | Convention: *At for times     |
| ProcessCompletedTime         | processCompletedAt   |                               |
| isProcessSuccessful          | isProcessSuccessful  | Keep                          |
| isEnabled                    | isEnabled            | Keep                          |
| isDebugRequest               | isDebugRequest       | Keep                          |
| JobNote                      | jobNote              | Normalize casing              |
| JobID                        | jobLabel             | Clarify: user-entered label   |
| objectID                     | objectId             | Normalize casing              |
| objectIDGeneratedAt          | objectIdGeneratedAt  | Normalize casing              |
| GeometryFileContents         | meshFileContents     | "mesh" = the STL output       |
| GeometryFileName             | meshFileName         |                               |
| GeometryBlobUrl              | meshBlobUrl          |                               |
| GeometryBlobPathname         | meshBlobPathname     |                               |
| PrintFileContents            | printFileContents    | Keep (moves to PrintJob later)|
| PrintFileName                | printFileName        | Keep casing                   |
| PrintBlobUrl                 | printBlobUrl         | Keep casing                   |
| PrintBlobPathname            | printBlobPathname    | Keep casing                   |
| ProcessingLog                | processingLog        | Normalize casing              |
| MeshMetadata                 | meshMetadata         | Normalize casing              |
| geometry (relation)          | design (relation)    |                               |
| printQueue (relation)        | printJobs (relation) |                               |
| creator (relation)           | creator (relation)   | Keep                          |
| owningOrganization (relation)| owningOrganization   | Keep                          |

## Field Renames: PrintJob (was PrintQueue)

| Old Field                      | New Field          | Notes                   |
|--------------------------------|--------------------|-------------------------|
| GeometryProcessingQueueID      | designJobId        | FK to DesignJob         |
| CreationTime                   | createdAt          |                         |
| PrintStartedTime               | printStartedAt     |                         |
| PrintCompletedTime             | printCompletedAt   |                         |
| isPrintSuccessful              | isPrintSuccessful  | Keep                    |
| printNote                      | printNote          | Keep                    |
| printAcceptance                | printAcceptance    | Keep                    |
| isEnabled                      | isEnabled          | Keep                    |
| progress                       | progress           | Keep                    |
| progressLastReportTime         | progressLastReportAt|                        |
| logs                           | logs               | Keep                    |
| printedByUserId                | printedByUserId    | Keep                    |
| acceptedByUserId               | acceptedByUserId   | Keep                    |
| geometryProcessingQueue (rel)  | designJob (rel)    |                         |
| printedBy (relation)           | printedBy          | Keep                    |
| acceptedBy (relation)          | acceptedBy         | Keep                    |

## Field Renames: OrganizationDesign (was OrganizationGeometry)

| Old Field        | New Field    | Notes              |
|------------------|--------------|--------------------|
| namedGeometryId  | designId     | FK to Design       |
| namedGeometry (rel) | design (rel)|                 |

## User model relation renames

| Old Relation Field      | New Relation Field     |
|-------------------------|------------------------|
| createdGeometryJobs     | createdDesignJobs      |
| printedJobs (PrintQueue)| printedJobs (PrintJob) |
| reviewedJobs (PrintQueue)| reviewedJobs (PrintJob)|

## Organization model relation renames

| Old Relation Field      | New Relation Field        |
|-------------------------|---------------------------|
| geometryJobs            | designJobs                |
| geometries              | designs                   |

## API Route Renames (splint_factory)

| Old Route                                        | New Route                                     |
|--------------------------------------------------|-----------------------------------------------|
| /api/geometry-jobs                               | /api/design-jobs                              |
| /api/geometry-jobs/[id]                          | /api/design-jobs/[id]                         |
| /api/geometry-jobs/[id]/geometry-file            | /api/design-jobs/[id]/mesh-file               |
| /api/geometry-jobs/[id]/print-file               | /api/design-jobs/[id]/print-file              |
| /api/geometries                                  | /api/designs                                  |
| /api/geometry-images/[geometryId]/[imageType]    | /api/design-images/[designId]/[imageType]     |
| /api/geometry-processing/next-job                | /api/design-processing/next-job               |
| /api/geometry-processing/mark-started            | /api/design-processing/mark-started           |
| /api/geometry-processing/result                  | /api/design-processing/result                 |
| /api/geometry-processing/job-by-id/[id]          | /api/design-processing/job-by-id/[id]         |
| /api/geometry-processing/processor-health        | /api/design-processing/processor-health       |
| /api/named-geometry/[id]                         | /api/admin/design-definitions/[id]            |
| /api/named-geometry (list)                       | /api/admin/design-definitions                 |
| /api/organizations/[id]/geometries               | /api/organizations/[id]/designs               |

## Page Route Renames (splint_factory)

| Old Page Route            | New Page Route          |
|---------------------------|-------------------------|
| /geo-job-menu             | /design-menu            |
| /geometry-jobs            | /design-jobs            |
| /geometry-jobs/new        | /design-jobs/new        |
| /geometry-jobs/[id]       | /design-jobs/[id]       |

## Nav/Label Changes

| Location                | Old Text                  | New Text                |
|-------------------------|---------------------------|-------------------------|
| Header.tsx green button | links to /geo-job-menu    | links to /design-menu   |
| Header.tsx tools menu   | "Design Generation Jobs"  | "Design Job History"    |
| Header.tsx tools menu   | links to /geometry-jobs   | links to /design-jobs   |
| geometry-jobs/page.tsx  | "Design Generation Jobs"  | "Design Job History"    |
| geometry-jobs/new       | "Geometry Type" label     | REMOVE selector, show name|
| middleware.ts           | redirects to /geo-job-menu| redirects to /design-menu|
| login/page.tsx          | redirects to /geo-job-menu| redirects to /design-menu|
| PublicLanding.tsx        | links to /geometry-jobs   | links to /design-jobs   |

## UX Changes

| Change                               | Details                                              |
|---------------------------------------|------------------------------------------------------|
| Kill GeometryJobProgressModal         | Delete component; redirect to job detail after create |
| geometry-jobs/new: remove selector    | Show design name as static header instead of dropdown |
| geometry-jobs/new: no params redirect | Redirect to /design-menu if no designId or template   |
| design-jobs/[id]: STL at top          | Move STL viewer to top with full-width status banner  |
| design-jobs/[id]: progress messages   | Show real-time polling progress inline on detail page |

## splint_geo_processor Changes

| Area                  | Old                                    | New                                    |
|-----------------------|----------------------------------------|----------------------------------------|
| API URL: next-job     | /api/geometry-processing/next-job      | /api/design-processing/next-job        |
| API URL: mark-started | /api/geometry-processing/mark-started  | /api/design-processing/mark-started    |
| API URL: result       | /api/geometry-processing/result        | /api/design-processing/result          |
| API URL: job-by-id    | /api/geometry-processing/job-by-id/    | /api/design-processing/job-by-id/      |
| Payload field         | GeometryProcessingQueueID              | (keep as jobId - already used)         |
| Payload field         | GeometryFileName                       | meshFileName                           |
| Payload field         | GeometryBlobUrl / geometryBlobUrl      | meshBlobUrl                            |
| Payload field         | GeometryBlobPathname / geometryBlobPathname | meshBlobPathname                  |
| Payload field         | GeometryAlgorithmName                  | algorithmName                          |
| Payload field         | GeometryInputParameterData             | inputParameters                        |
| Payload field         | ProcessCompletedTime                   | processCompletedAt                     |
| Payload field         | CustomerID (legacy refs)               | Remove/update                          |

## splint_client Changes

| Area              | Change                                          |
|-------------------|-------------------------------------------------|
| main.js URLs      | /print-queue stays (page route unchanged)       |
| main.js           | Review printQueue variable names (cosmetic only)|
| doc files         | Update any geometry-jobs references             |

## Files NOT Modified (intentional)

| File/Area                    | Reason                                              |
|------------------------------|-----------------------------------------------------|
| Old migration SQL files      | Immutable history; rename migration added on top     |
| /print-queue page route      | Keeping as-is per discussion                         |
| agent-instructions/*.md      | Update after code changes verified                   |

## Admin Page Renames

| Old Route                    | New Route                        | Old Label               | New Label              |
|------------------------------|----------------------------------|-------------------------|------------------------|
| /admin/named-geometry        | /admin/design-definitions        | Named Geometry Designs  | Design Definitions     |
| /admin/named-geometry/[id]   | /admin/design-definitions/[id]   | (edit page)             | (edit page)            |
