import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/geometries - Optimized listing for user-facing landing page (/geo-job-menu)
// Returns lightweight metadata only (no image Bytes), supports activeOnly filter
// Differs from /api/named-geometry which returns full data for admin CRUD operations
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeOnly = request.nextUrl.searchParams.get('activeOnly') === 'true';

    const geometries = await prisma.namedGeometry.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      select: {
        id: true,
        GeometryName: true,
        GeometryAlgorithmName: true,
        shortDescription: true,
        previewImageUpdatedAt: true,
        measurementImageUpdatedAt: true,
        CreationTime: true,
      },
      orderBy: {
        GeometryName: 'asc',
      },
    });

    return NextResponse.json(geometries);
  } catch (error) {
    console.error('Error fetching geometries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
