import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/geometry-processing/debug - Create a debug request for a geometry job
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    // Only admins can create debug requests
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    // Find the original job
    const originalJob = await prisma.geometryProcessingQueue.findUnique({
      where: { id: jobId },
      include: {
        geometry: true
      }
    });

    if (!originalJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Create a new queue entry with isDebugRequest flag
    const debugJob = await prisma.geometryProcessingQueue.create({
      data: {
        objectID: `debug-${Date.now()}`,
        GeometryID: originalJob.GeometryID,
        GeometryInputParameterData: originalJob.GeometryInputParameterData,
        CustomerNote: `DEBUG: ${originalJob.CustomerNote || 'Manual debug request'}`,
        CustomerID: originalJob.CustomerID,
        CreatorID: session.user.id,
        OwningOrganizationID: originalJob.OwningOrganizationID,
        isEnabled: true,
        isDebugRequest: true  // Flag for debug mode
      }
    });

    // Fetch geometry info for the response message
    const geometry = await prisma.namedGeometry.findUnique({
      where: { id: debugJob.GeometryID },
      select: { GeometryName: true, GeometryAlgorithmName: true }
    });

    console.log(`Created debug request ${debugJob.id} for job ${jobId} by ${session.user.name}`);

    return NextResponse.json({
      success: true,
      debugJobId: debugJob.id,
      message: `Debug request created for ${geometry?.GeometryName || 'geometry'}. The processor will launch Grasshopper with the script.`
    });

  } catch (error) {
    console.error('Error creating debug request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
