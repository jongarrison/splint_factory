import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/design-images/[designId]/[imageType]
// Serves binary image data with proper Content-Type and long-term caching headers
// Allows images to be used in <img> tags (e.g., <img src="/api/design-images/123/preview" />)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ designId: string; imageType: string }> }
) {
  try {
    // Require authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { designId, imageType } = await params;
    
    // Validate image type
    if (!['preview', 'measurement'].includes(imageType)) {
      return NextResponse.json({ error: 'Invalid image type' }, { status: 400 });
    }

    // Get geometry with requested image
    const design = await prisma.design.findUnique({
      where: { id: designId },
      select: {
        previewImage: true,
        previewImageContentType: true,
        previewImageUpdatedAt: true,
        measurementImage: true,
        measurementImageContentType: true,
        measurementImageUpdatedAt: true,
      }
    });

    if (!design) {
      return NextResponse.json({ error: 'Geometry not found' }, { status: 404 });
    }

    const imageData = imageType === 'preview' ? design.previewImage : design.measurementImage;
    const contentType = imageType === 'preview' ? design.previewImageContentType : design.measurementImageContentType;
    const updatedAt = imageType === 'preview' ? design.previewImageUpdatedAt : design.measurementImageUpdatedAt;

    if (!imageData) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Return image with long cache headers
    const response = new NextResponse(imageData, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
        'Last-Modified': updatedAt ? updatedAt.toUTCString() : new Date().toUTCString(),
      },
    });

    return response;
  } catch (error) {
    console.error('Error serving geometry image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
