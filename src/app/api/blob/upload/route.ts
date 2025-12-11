import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, checkApiPermission } from '@/lib/api-auth';
import { handleUpload } from '@vercel/blob/client';

/**
 * POST /api/blob/upload - Vercel Blob client upload handler
 * 
 * This endpoint uses Vercel's handleUpload() to:
 * 1. Generate temporary client tokens for uploads (on token request)
 * 2. Receive upload completion callbacks (on upload complete)
 * 
 * The processor calls upload() from @vercel/blob/client which:
 * - Requests a token from this endpoint
 * - Uploads directly to Vercel Blob
 * - Notifies this endpoint on completion
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

    const body = await request.json();

    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        // Validate token request before generating
        console.log(`Generating client token for: ${pathname} (multipart: ${multipart})`);
        
        return {
          // Allow all content types (STL, 3MF, GCODE, etc.)
          allowedContentTypes: [
            'model/stl',
            'model/3mf', 
            'application/x-3mf',
            'text/plain',           // GCODE
            'application/octet-stream'
          ],
          // 500MB limit per file (Vercel Blob max)
          maximumSizeInBytes: 500 * 1024 * 1024,
          // Token valid for 1 hour
          validUntil: Date.now() + 60 * 60 * 1000,
          // Add random suffix to prevent collisions
          addRandomSuffix: true,
          // Public access (we control via API)
          tokenPayload: JSON.stringify({ 
            uploadedBy: apiAuth.apiKey?.name,
            timestamp: Date.now() 
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Log successful upload
        console.log(`Upload completed: ${blob.pathname} (${blob.url})`);
        if (tokenPayload) {
          const payload = JSON.parse(tokenPayload);
          console.log(`Uploaded by: ${payload.uploadedBy} at ${new Date(payload.timestamp).toISOString()}`);
        }
      },
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in blob upload handler:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
