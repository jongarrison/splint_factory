import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Clean up all debug jobs and their associated print queue entries.
 * Used before creating new debug jobs to prevent objectID collisions.
 */
async function cleanupDebugJobs() {
  // Delete all print queue entries for debug jobs
  const debugJobs = await prisma.geometryProcessingQueue.findMany({
    where: { isDebugRequest: true },
    select: { id: true }
  });
  
  if (debugJobs.length > 0) {
    await prisma.printQueue.deleteMany({
      where: {
        GeometryProcessingQueueID: {
          in: debugJobs.map(j => j.id)
        }
      }
    });
  }
  
  // Delete all debug geometry jobs
  const result = await prisma.geometryProcessingQueue.deleteMany({
    where: { isDebugRequest: true }
  });
  
  return result.count;
}

// POST /api/geometry-processing/debug - Create a debug request for a geometry job
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    // Only admins can create debug requests
    if (!session?.user?.id || session.user.role !== 'SYSTEM_ADMIN') {
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

    // Clean up any existing debug jobs before creating a new one
    // This allows us to safely reuse "DBUG" as objectID
    const cleanedCount = await cleanupDebugJobs();
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} existing debug job(s)`);
    }

    // Create a new queue entry with isDebugRequest flag
    const debugJob = await prisma.geometryProcessingQueue.create({
      data: {
        objectID: 'DBUG',
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
