import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAllDesigns } from '@/designs/registry';

// GET /api/designs - Design listing for user-facing pages
// Merges code-based registry data with DB org visibility.
// Supports ?activeOnly=true and ?includeSchema=true
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Look up the user's org to scope visibility
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, role: true },
    });

    const activeOnly = request.nextUrl.searchParams.get('activeOnly') === 'true';
    const includeSchema = request.nextUrl.searchParams.get('includeSchema') === 'true';

    // Get all designs from code registry
    let designs = getAllDesigns();
    if (activeOnly) {
      designs = designs.filter(d => d.isActive);
    }

    // Get visible design IDs for this user's org
    let visibleIds: Set<string> | null = null;
    if (user?.organizationId) {
      const orgDesigns = await prisma.organizationDesign.findMany({
        where: { organizationId: user.organizationId },
        select: { designId: true },
      });
      visibleIds = new Set(orgDesigns.map(od => od.designId));
    }

    const result = designs
      .filter(d => !visibleIds || visibleIds.has(d.id))
      .map(d => ({
        id: d.id,
        name: d.name,
        algorithmName: d.algorithmName,
        shortDescription: d.shortDescription,
        slug: d.slug,
        isActive: d.isActive,
        hasPreviewImage: d.hasPreviewImage,
        hasMeasurementImage: d.hasMeasurementImage,
        hasCustomForm: d.hasCustomForm,
        ...(includeSchema ? { inputParameters: d.inputParameters } : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching designs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
