import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey, checkApiPermission } from '@/lib/api-auth';
import { getDesignById } from '@/designs/registry';

// GET /api/design-processing/job-by-id/[id]
// Fetch a geometry processing job by either its UUID (cuid) or objectID.
// Read-only -- no mutations. Used by the geo processor's inspect mode.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const apiAuth = await validateApiKey(request);
    if (!apiAuth.success || !checkApiPermission(apiAuth.apiKey, 'geometry-queue:read')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
    }

    const includeRelations = {
      design: {
        select: {
          name: true,
          algorithmName: true,
        }
      },
      creator: {
        select: { id: true, name: true, email: true }
      },
      owningOrganization: {
        select: { id: true, name: true }
      },
    };

    // Try UUID lookup first (cuids are 25+ chars, objectIDs are short)
    let job = await prisma.designJob.findUnique({
      where: { id },
      include: includeRelations,
    });

    // Fall back to objectID lookup
    if (!job) {
      job = await prisma.designJob.findUnique({
        where: { objectId: id },
        include: includeRelations,
      });
    }

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get inputParameterSchema from code registry
    const registryDesign = getDesignById(job.designId);

    return NextResponse.json({
      id: job.id,
      objectId: job.objectId,
      designId: job.designId,
      name: job.design.name,
      algorithmName: job.design.algorithmName,
      inputParameterSchema: registryDesign ? JSON.stringify(registryDesign.inputParameters) : '[]',
      inputParameters: job.inputParameters,
      jobNote: job.jobNote,
      jobLabel: job.jobLabel,
      createdAt: job.createdAt,
      processStartedAt: job.processStartedAt,
      processCompletedAt: job.processCompletedAt,
      isProcessSuccessful: job.isProcessSuccessful,
      meshFileName: job.meshFileName ?? null,
      printFileName: job.printFileName ?? null,
      meshMetadata: job.meshMetadata ?? null,
      creator: job.creator,
      owningOrganization: job.owningOrganization,
    });
  } catch (error) {
    console.error('Error fetching geometry job by ID:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
