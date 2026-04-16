import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAllDesigns } from '@/designs/registry';

// GET /api/admin/design-definitions - Design data from code registry for admin pages
// Supports ?all=true for SYSTEM_ADMIN to bypass org visibility filter
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

    const wantAll = request.nextUrl.searchParams.get('all') === 'true';
    const skipOrgFilter = wantAll && user?.role === 'SYSTEM_ADMIN';

    // Get all designs from code registry
    const allDesigns = getAllDesigns();

    // Apply org visibility filter unless skipped
    let visibleIds: Set<string> | null = null;
    if (!skipOrgFilter && user?.organizationId) {
      const orgDesigns = await prisma.organizationDesign.findMany({
        where: { organizationId: user.organizationId },
        select: { designId: true },
      });
      visibleIds = new Set(orgDesigns.map(od => od.designId));
    }

    const result = allDesigns
      .filter(d => !visibleIds || visibleIds.has(d.id))
      .map(d => ({
        id: d.id,
        name: d.name,
        algorithmName: d.algorithmName,
        shortDescription: d.shortDescription,
        isActive: d.isActive,
        slug: d.slug,
        // Provide inputParameterSchema as JSON string for backward compatibility with admin UI
        inputParameterSchema: JSON.stringify(d.inputParameters),
        hasPreviewImage: d.hasPreviewImage,
        hasMeasurementImage: d.hasMeasurementImage,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching design definitions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
