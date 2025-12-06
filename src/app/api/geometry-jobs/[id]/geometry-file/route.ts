import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getBlobStorageInstance } from '@/lib/blob-storage';

function getMimeType(filename: string | null | undefined): string {
  if (!filename) return 'application/octet-stream';
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

function safeFilename(name: string) {
  // Prevent header injection and path traversal in Content-Disposition
  return name.replace(/[\r\n\\/\u0000-\u001F]/g, '_');
}

// GET /api/geometry-jobs/[id]/geometry-file - Download geometry file for a job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get user with organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        organizationId: true,
      },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User must be part of an organization' }, { status: 403 });
    }

    // Fetch the job with file contents
    const job = await prisma.geometryProcessingQueue.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json({ error: 'Geometry job not found' }, { status: 404 });
    }

    if (job.OwningOrganizationID !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const gpq = job as any;
    
    // Check if file is stored in blob storage (new format)
    if (gpq.GeometryBlobUrl) {
      // For local development, check if it's a local blob URL
      if (gpq.GeometryBlobUrl.startsWith('/api/local-blob/')) {
        const fs = await import('fs/promises');
        const path = await import('path');
        const storageDir = path.join(process.cwd(), '.blob-storage');
        const filePath = path.join(storageDir, gpq.GeometryBlobPathname);
        
        const fileBuffer = await fs.readFile(filePath);
        const contentType = getMimeType(gpq.GeometryFileName as string);
        const body = new Uint8Array(fileBuffer);

        return new NextResponse(body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(body.byteLength),
            'Cache-Control': 'private, max-age=3600',
          },
        });
      }
      
      // For production Vercel Blob, redirect to the stored URL
      return NextResponse.redirect(gpq.GeometryBlobUrl);
    }
    
    // Fallback to legacy BYTEA storage
    if (!gpq.GeometryFileContents || !gpq.GeometryFileName) {
      return NextResponse.json({ error: 'No geometry file available for this job' }, { status: 404 });
    }

    const contentType = getMimeType(gpq.GeometryFileName as string);
    const filename = safeFilename(gpq.GeometryFileName as string);
    const buf: Buffer = Buffer.from(gpq.GeometryFileContents as Buffer);
    const body = new Uint8Array(buf);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.byteLength),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Error downloading geometry file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
