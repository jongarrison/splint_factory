Endpoint inventory
Auth & identity
GET/POST /api/auth/[...nextauth] (route.ts) – NextAuth.js callback/session endpoints handling OAuth credentials and CSRF-protected form posts.
POST /api/register – Accepts JSON { name, email, password, invitationToken? } to create users; validates invitations and hashes passwords.
GET /api/profile, PUT /api/profile – Fetch or update the signed-in user; PUT expects JSON with profile fields and optional password change fields.
GET /api/users, PATCH /api/users – Org/system admins list users or patch { userId, role?, organizationId? }.
GET /api/invitations, POST /api/invitations – Lists org invitations or creates new ones from JSON { organizationId, expiresInDays? }.
GET /api/organizations, POST /api/organizations – Read/write organization records via JSON payloads.
Geometry catalog & media
GET /api/geometries – Returns lightweight geometry metadata; respects activeOnly=true query param.
GET /api/named-geometry, POST /api/named-geometry – Admin list plus multipart/form-data creation (fields + optional previewImage/measurementImage files).
GET /api/named-geometry/[id], PUT /api/named-geometry/[id], DELETE /api/named-geometry/[id] – Retrieve, update (multipart/form-data), or delete a specific geometry.
GET /api/geometry-images/[geometryId]/[imageType] – Streams preview/measurement images by ID with caching headers.
Geometry jobs & processing pipeline
GET /api/geometry-jobs, POST /api/geometry-jobs – Lists jobs or creates one from JSON containing GeometryID, GeometryInputParameterData, customer info, etc.
GET/PUT/DELETE /api/geometry-jobs/[id] – Per-job CRUD (JSON inputs) with org-access checks.
GET /api/geometry-jobs/[id]/geometry-file and GET /api/geometry-jobs/[id]/print-file – Streams stored binary geometry/print files with appropriate Content-Disposition.
GET /api/geometry-processing/next-job – External processors (API key or session auth) pull the next unstarted job; no body, responds with JSON job payload.
POST /api/geometry-processing/result – External processors POST JSON { GeometryProcessingQueueID, isSuccess, …, GeometryFileContents?, PrintFileContents? } with base64 blobs (10 MB limit) plus optional logs.
Print queue operations
GET /api/print-queue, POST /api/print-queue – List queue entries or create one by posting base64 file payloads and metadata.
GET/PUT /api/print-queue/[id] – Fetch a queue item (optional includeFiles=true) or update JSON fields for status, notes, and optional base64 files.
PUT /api/print-queue/[id]/logs – Updates stored logs via JSON { logs: string }.
PUT /api/print-queue/[id]/progress – JSON { progress, filename? } to track hardware status; broadcasts via server-sent events.
POST /api/print-queue/[id]/acceptance – Records acceptance decision from JSON { printAcceptance: boolean, printNote? }.
GET /api/print-queue/events – Server-Sent Events stream; GET request keeps an authenticated connection open to receive broadcast updates.
API keys & admin tooling
GET/POST /api/api-keys – System admins list keys or POST JSON { name, permissions: string[], organizationId? } (plain key returned once).
GET/PUT/DELETE /api/api-keys/[id] – Manage individual key metadata with JSON bodies.
Every endpoint above lives under route.ts and therefore can receive outside HTTP input when deployed. Almost all require a valid NextAuth session; geometry-processing/* additionally supports API-key authentication for headless processors, and print-queue/events insists on a session cookie for SSE. File-uploading routes (named-geometry and some print/geometry queue handlers) use multipart/form-data, while the rest consume JSON (or binary streaming for media download endpoints).

Notes & next steps
Authorization is enforced per route (system admin vs org admin vs member), so documenting permissible roles alongside this inventory could help future audits.
Consider generating OpenAPI/Swagger docs from these handlers for automated verification and client generation.
Quality gates
Build: not run (read-only analysis).
Lint/Typecheck: not run.
Tests: not run.