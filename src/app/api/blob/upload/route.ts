import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, checkApiPermission } from '@/lib/api-auth';
import { handleUpload } from '@vercel/blob/client';
import { getBlobStorageInstance } from '@/lib/blob-storage';

/**
 * POST /api/blob/upload - Blob upload handler (production and development)
 * 
 * Production (Vercel Blob):
 *   Uses handleUpload() to generate temporary client tokens for direct uploads
 * 
 * Development (Filesystem):
 *   Accepts multipart file uploads and stores in .blob-storage/ directory
 */
export async function POST(request: NextRequest) {
  try {
    // Require API key authentication
    const apiAuth = await validateApiKey(request);
    
    if (!apiAuth.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Validate API key has required permission
    if (!checkApiPermission(apiAuth.apiKey, 'geometry-queue:write')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Check if we're using Vercel Blob (production) or filesystem (local dev)
    const useVercelBlob = process.env.BLOB_STORAGE_TYPE === 'vercel' || 
                          process.env.VERCEL === '1' ||
                          process.env.NODE_ENV === 'production';

    if (useVercelBlob) {
      // Production: Use handleUpload for client token generation
      console.log('[blob/upload] Using Vercel Blob client upload (production mode)');
      const body = await request.json();

      const result = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
          console.log(`Generating client token for: ${pathname} (multipart: ${multipart})`);
          
          return {
            allowedContentTypes: [
              'model/stl',
              'model/3mf', 
              'application/x-3mf',
              'text/plain',           // GCODE
              'application/octet-stream'
            ],
            maximumSizeInBytes: 500 * 1024 * 1024,
            validUntil: Date.now() + 60 * 60 * 1000,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ 
              uploadedBy: apiAuth.apiKey?.name,
              timestamp: Date.now() 
            }),
          };
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          console.log(`Upload completed: ${blob.pathname} (${blob.url})`);
          if (tokenPayload) {
            const payload = JSON.parse(tokenPayload);
            console.log(`Uploaded by: ${payload.uploadedBy} at ${new Date(payload.timestamp).toISOString()}`);
          }
        },
      });

      return NextResponse.json(result);

    } else {
      // Local development: Accept multipart uploads and store in filesystem
      console.log('[blob/upload] Using filesystem storage (local development mode)');
      const contentType = request.headers.get('content-type') || '';
      
      if (!contentType.includes('multipart/form-data')) {
        return NextResponse.json({ 
          error: 'Local dev requires multipart/form-data. Production uses client tokens.' 
        }, { status: 400 });
      }

      const formData = await request.formData();
      const files = formData.getAll('files') as File[];
      
      if (!files || files.length === 0) {
        return NextResponse.json({ 
          error: 'No files provided' 
        }, { status: 400 });
      }

      const blobStorage = getBlobStorageInstance();
      const uploads = await Promise.all(
        files.map(async (file) => {
          const buffer = Buffer.from(await file.arrayBuffer());
          const result = await blobStorage.upload(buffer, file.name);
          console.log(`Uploaded file to local storage: ${result.pathname} (${result.size} bytes)`);
          return {
            filename: file.name,
            url: result.url,
            pathname: result.pathname,
            size: result.size,
            contentType: result.contentType,
          };
        })
      );

      return NextResponse.json({ 
        success: true,
        uploads 
      }, { status: 200 });
    }

  } catch (error) {
    console.error('Error in blob upload handler:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
