import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey, checkApiPermission } from '@/lib/api-auth';

// GET /api/geometry-processing/job-by-id/[id]
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
      geometry: {
        select: {
          GeometryName: true,
          GeometryAlgorithmName: true,
          GeometryInputParameterSchema: true,
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
    let job = await prisma.geometryProcessingQueue.findUnique({
      where: { id },
      include: includeRelations,
    });

    // Fall back to objectID lookup
    if (!job) {
      job = await prisma.geometryProcessingQueue.findUnique({
        where: { objectID: id },
        include: includeRelations,
      });
    }

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      objectID: job.objectID,
      GeometryID: job.GeometryID,
      GeometryName: job.geometry.GeometryName,
      GeometryAlgorithmName: job.geometry.GeometryAlgorithmName,
      GeometryInputParameterSchema: job.geometry.GeometryInputParameterSchema,
      GeometryInputParameterData: job.GeometryInputParameterData,
      JobNote: job.JobNote,
      JobID: job.JobID,
      CreationTime: job.CreationTime,
      ProcessStartedTime: job.ProcessStartedTime,
      ProcessCompletedTime: job.ProcessCompletedTime,
      isProcessSuccessful: job.isProcessSuccessful,
      GeometryFileName: job.GeometryFileName ?? null,
      PrintFileName: job.PrintFileName ?? null,
      MeshMetadata: job.MeshMetadata ?? null,
      creator: job.creator,
      owningOrganization: job.owningOrganization,
    });
  } catch (error) {
    console.error('Error fetching geometry job by ID:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
