import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey, checkApiPermission } from '@/lib/api-auth';

// POST /api/geometry-processing/mark-started - Mark a job as started
export async function POST(request: NextRequest) {
  try {
    // API key authentication required
    const apiAuth = await validateApiKey(request);
    
    if (!apiAuth.success || !checkApiPermission(apiAuth.apiKey, 'geometry-queue:write')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }

    // Mark the job as started
    const updatedJob = await prisma.geometryProcessingQueue.update({
      where: { id: jobId },
      data: {
        ProcessStartedTime: new Date()
      },
      select: {
        id: true,
        ProcessStartedTime: true,
        geometry: {
          select: {
            GeometryName: true
          }
        }
      }
    });

    console.log(`Marked geometry job ${updatedJob.id} (${updatedJob.geometry.GeometryName}) as started at ${updatedJob.ProcessStartedTime}`);

    return NextResponse.json({ 
      success: true,
      jobId: updatedJob.id,
      startedAt: updatedJob.ProcessStartedTime
    });

  } catch (error) {
    console.error('Error marking job as started:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
