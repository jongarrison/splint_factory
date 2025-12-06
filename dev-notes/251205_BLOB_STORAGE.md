# Blob Storage Implementation

## Overview

Implemented blob storage solution for geometry and print files to overcome Vercel's 4.5MB request body limit. Files are now uploaded directly without base64 encoding, supporting up to 500MB per file.

## Architecture

### Abstraction Layer
- **Location:** `splint_factory/src/lib/blob-storage.ts`
- **Interface:** `BlobStorage` with `upload()`, `getSignedUrl()`, and `delete()` methods
- **Implementations:**
  - `VercelBlobStorage`: Production using `@vercel/blob` SDK
  - `FilesystemBlobStorage`: Local development using `.blob-storage/` directory

### Database Schema
Added to `GeometryProcessingQueue` model:
- `GeometryBlobUrl`: Reference URL for geometry file
- `GeometryBlobPathname`: Pathname for signed URL generation
- `PrintBlobUrl`: Reference URL for print file
- `PrintBlobPathname`: Pathname for signed URL generation

Legacy `GeometryFileContents` and `PrintFileContents` BYTEA fields retained for backwards compatibility.

### API Changes

#### Result Upload (`/api/geometry-processing/result`)
- **New format:** `multipart/form-data` with file streams
- **Legacy format:** JSON with base64 (still supported)
- Files uploaded to blob storage, URLs stored in database
- Limits: 500MB per file (blob), 10MB (legacy base64)

#### File Download (`/api/geometry-jobs/[id]/geometry-file`)
- Checks for `GeometryBlobPathname` first (new format)
- Generates signed URL and redirects to blob storage
- Falls back to serving BYTEA directly (legacy format)

#### Local Blob Serving (`/api/local-blob/[pathname]`)
- Development-only endpoint
- Serves files from `.blob-storage/` directory
- Requires authentication (session-based access control)

### Geo Processor Changes
- **Upload format:** Changed from base64 JSON to multipart/form-data
- **Dependencies:** Added `form-data` package
- **File handling:** Streams files directly from disk (no in-memory base64 encoding)
- **Payload logging:** Now logs file sizes instead of base64 sizes

## Usage

### Environment Detection
Auto-detects based on:
- `BLOB_STORAGE_TYPE=vercel` (explicit)
- `VERCEL=1` (Vercel deployment)
- `NODE_ENV=production` (production mode)
- Otherwise: Filesystem storage

### Vercel Blob Setup (Production)
1. Vercel Blob automatically available on Pro/Enterprise plans
2. No additional configuration needed
3. Files stored in Vercel's blob storage
4. Access via signed URLs

### Local Development
1. Files stored in `splint_factory/.blob-storage/`
2. Directory auto-created on first upload
3. Served via `/api/local-blob/[pathname]` endpoint
4. `.blob-storage/` added to `.gitignore`

## File Flow

### Upload (geo_processor → factory)
1. Geo processor reads STL/3MF files from disk
2. Creates `FormData` with file streams
3. POSTs to `/api/geometry-processing/result` as multipart
4. Factory receives files, uploads to blob storage
5. Blob URLs stored in database

### Download (factory → viewer)
1. Viewer requests `/api/geometry-jobs/[id]/geometry-file`
2. API checks authorization (organization membership)
3. API looks up `GeometryBlobPathname` from database
4. API generates signed URL (or local path)
5. Redirects to blob URL
6. Browser loads STL directly from blob storage

## Access Control

### Production (Vercel Blob)
- Blobs stored with public access (no token required)
- Access control at API level (organization membership check)
- Could implement signed URLs with expiration if needed

### Development (Filesystem)
- Files served through API route
- Authentication required (session check)
- Organization membership verified

## Migration Notes

- **No data migration needed**: Legacy BYTEA fields retained
- **Backwards compatible**: API accepts both formats
- **Gradual transition**: Old jobs use BYTEA, new jobs use blobs
- **Dev data**: Can be discarded, no complex migration

## Testing Checklist

- [ ] Local dev: Process geometry job, verify `.blob-storage/` created
- [ ] Local dev: View STL preview in browser
- [ ] Production: Process geometry job, verify Vercel Blob upload
- [ ] Production: View STL preview in browser
- [ ] Large files: Test with >4.5MB STL (should work with multipart)
- [ ] Legacy format: Verify old JSON base64 format still works
- [ ] Access control: Verify unauthorized users can't access files

## Cost Estimates

**Vercel Blob (per 1,000 jobs, 4.3GB total):**
- Storage: $0.65/month
- Bandwidth (2× views): $17.20
- **Total:** ~$18/month

**At 10,000 jobs:** ~$178/month  
**At 100,000 jobs:** ~$1,785/month

For high volume (>7,000 jobs/month), consider migrating to S3 (~20× cheaper).

## Files Changed

### splint_factory
- `src/lib/blob-storage.ts` (new)
- `src/app/api/local-blob/[pathname]/route.ts` (new)
- `src/app/api/geometry-processing/result/route.ts` (modified)
- `src/app/api/geometry-jobs/[id]/geometry-file/route.ts` (modified)
- `prisma/schema.prisma` (modified)
- `.gitignore` (modified)
- `package.json` (added `@vercel/blob`)

### splint_geo_processor
- `src/processors/processor.ts` (modified)
- `package.json` (added `form-data`)
