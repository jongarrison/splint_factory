import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/organizations/[id]/geometries - List geometry IDs visible to this org
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, organizationId: true },
    });

    const { id } = await params;

    const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';
    const isOrgAdmin = user?.role === 'ORG_ADMIN' && user?.organizationId === id;
    if (!isSystemAdmin && !isOrgAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      );
    }

    const rows = await prisma.organizationDesign.findMany({
      where: { organizationId: id },
      select: { designId: true },
    });

    return NextResponse.json(rows.map((r) => r.designId));
  } catch (error) {
    console.error('Error fetching org geometries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/organizations/[id]/geometries - Replace geometry visibility set
// Body: { geometryIds: string[] }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, organizationId: true },
    });

    const { id } = await params;

    const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';
    const isOrgAdmin = user?.role === 'ORG_ADMIN' && user?.organizationId === id;
    if (!isSystemAdmin && !isOrgAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const geometryIds: string[] = body.geometryIds;

    if (!Array.isArray(geometryIds)) {
      return NextResponse.json(
        { error: 'geometryIds must be an array of strings' },
        { status: 400 }
      );
    }

    // Verify organization exists
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Replace the full set in a transaction
    await prisma.$transaction([
      prisma.organizationDesign.deleteMany({
        where: { organizationId: id },
      }),
      ...(geometryIds.length > 0
        ? [
            prisma.organizationDesign.createMany({
              data: geometryIds.map((geoId) => ({
                organizationId: id,
                designId: geoId,
              })),
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ success: true, count: geometryIds.length });
  } catch (error) {
    console.error('Error updating org geometries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
