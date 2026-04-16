import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDesignById } from '@/designs/registry';

// GET /api/designs/[id] - Full design definition from code registry
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
    const design = getDesignById(id);

    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: design.id,
      name: design.name,
      algorithmName: design.algorithmName,
      shortDescription: design.shortDescription,
      isActive: design.isActive,
      slug: design.slug,
      inputParameters: design.inputParameters,
      hasPreviewImage: design.hasPreviewImage,
      hasMeasurementImage: design.hasMeasurementImage,
      hasCustomForm: design.hasCustomForm,
    });
  } catch (error) {
    console.error('Error fetching design:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
