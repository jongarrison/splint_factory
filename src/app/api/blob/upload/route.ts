import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, checkApiPermission } from '@/lib/api-auth';
import { getBlobStorageInstance } from '@/lib/blob-storage';

// POST /api/blob/upload - Upload files to blob storage
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

    const contentType = request.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ 
        error: 'Content-Type must be multipart/form-data' 
      }, { status: 400 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ 
        error: 'No files provided' 
      }, { status: 400 });
    }

    // Validate file size limits (500MB per file)
    const maxFileSize = 500 * 1024 * 1024; // 500MB
    for (const file of files) {
      if (file.size > maxFileSize) {
        return NextResponse.json({ 
          error: `File ${file.name} exceeds 500MB limit` 
        }, { status: 400 });
      }
    }

    // Upload all files to blob storage
    const blobStorage = getBlobStorageInstance();
    const uploads = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await blobStorage.upload(buffer, file.name);
        console.log(`Uploaded file to blob storage: ${result.pathname} (${result.size} bytes)`);
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

  } catch (error) {
    console.error('Error uploading files to blob storage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
