import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAllDesigns } from '@/designs/registry';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, role: true },
    });

    if (!user || (user.role !== 'SYSTEM_ADMIN' && !user.organizationId)) {
      return NextResponse.json({ error: 'User must be part of an organization' }, { status: 403 });
    }

    const requestedOrganizationId = request.nextUrl.searchParams.get('organizationId');
    if (
      user.role !== 'SYSTEM_ADMIN' &&
      requestedOrganizationId &&
      requestedOrganizationId !== user.organizationId
    ) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const organizationId = user.role === 'SYSTEM_ADMIN'
      ? requestedOrganizationId || user.organizationId
      : user.organizationId;

    const [organizations, visibleDesignRows] = await Promise.all([
      user.role === 'SYSTEM_ADMIN'
        ? prisma.organization.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
      organizationId && organizationId !== 'all'
        ? prisma.organizationDesign.findMany({
            where: { organizationId },
            select: { designId: true },
          })
        : Promise.resolve(null),
    ]);

    const visibleDesignIds = visibleDesignRows
      ? new Set(visibleDesignRows.map((row) => row.designId))
      : null;
    const designs = getAllDesigns()
      .filter((design) => !visibleDesignIds || (design.isActive && visibleDesignIds.has(design.id)))
      .map((design) => ({ id: design.id, name: design.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      isSystemAdmin: user.role === 'SYSTEM_ADMIN',
      defaultOrganizationId: user.organizationId,
      organizations,
      designs,
    });
  } catch (error) {
    console.error('Error fetching design job filter options:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}