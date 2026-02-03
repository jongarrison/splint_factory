import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortcode: string }> }
) {
  try {
    const { shortcode } = await params;

    // Find the link
    const link = await prisma.link.findUnique({
      where: { shortcode },
    });

    if (!link || !link.isActive) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    // Get visitor info for tracking
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || null;
    const referer = request.headers.get('referer') || null;

    // Async logging (fire and forget)
    prisma.linkActivity.create({
      data: {
        linkId: link.id,
        ipAddress,
        userAgent,
        referer,
      }
    }).then(() => {
      // Update click count
      return prisma.link.update({
        where: { id: link.id },
        data: { clickCount: { increment: 1 } }
      });
    }).catch((error: unknown) => {
      console.error('Error logging link activity:', error);
    });

    // Redirect based on link type
    if (link.linkType === 'EXTERNAL_URL') {
      return NextResponse.redirect(link.linkTarget);
    } else {
      // HOSTED_FILE - serve file directly with proper headers
      try {
        const filePath = join(process.cwd(), 'public-by-link', link.linkTarget);
        const fileBuffer = await readFile(filePath);
        
        // Determine content type based on file extension
        const ext = link.linkTarget.split('.').pop()?.toLowerCase();
        const contentTypes: Record<string, string> = {
          'pdf': 'application/pdf',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'ppt': 'application/vnd.ms-powerpoint',
          'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'zip': 'application/zip',
          'txt': 'text/plain',
        };
        const contentType = contentTypes[ext || ''] || 'application/octet-stream';
        
        // Extract filename from linkTarget (in case it has a path)
        const filename = link.linkTarget.split('/').pop() || link.linkTarget;
        
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      } catch (fileError) {
        console.error('Error serving file:', fileError);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
    }

  } catch (error) {
    console.error('Error processing link redirect:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
