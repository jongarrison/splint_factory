import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/geometries - Optimized listing for user-facing landing page (/geo-job-menu)
// Returns lightweight metadata only (no image Bytes), supports activeOnly filter
// Scoped to geometries visible to the requesting user's organization
// Differs from /api/named-geometry which returns full data for admin CRUD operations
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Look up the user's org to scope visibility
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    const activeOnly = request.nextUrl.searchParams.get('activeOnly') === 'true';

    // Build where clause: active filter + org visibility
    const where: Record<string, unknown> = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (user?.organizationId) {
      where.organizations = {
        some: { organizationId: user.organizationId },
      };
    }

    const geometries = await prisma.namedGeometry.findMany({
      where,
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
