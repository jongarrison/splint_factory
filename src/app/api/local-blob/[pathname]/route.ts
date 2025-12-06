import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'stl':
      return 'model/stl';
    case 'obj':
      return 'text/plain';
    case '3mf':
      return 'model/3mf';
    case 'gcode':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Local blob storage API route (development only)
 * Serves files from .blob-storage/ directory with session-based access control
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pathname: string }> }
) {
  try {
    // Require authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pathname } = await params;

    // Security: prevent directory traversal
    const sanitizedPathname = path.basename(pathname);
    if (pathname !== sanitizedPathname) {
      return NextResponse.json({ error: 'Invalid pathname' }, { status: 400 });
    }

    // Read file from local blob storage
    const storageDir = path.join(process.cwd(), '.blob-storage');
    const filePath = path.join(storageDir, sanitizedPathname);

    const fileBuffer = await fs.readFile(filePath);
    const contentType = getMimeType(sanitizedPathname);
    const body = new Uint8Array(fileBuffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.byteLength),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error serving local blob:', error);
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'Blob not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
