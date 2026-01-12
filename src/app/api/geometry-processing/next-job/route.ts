import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateApiKey, checkApiPermission } from '@/lib/api-auth';
import { updateProcessorPing } from '@/lib/geo-processor-health';

// GET /api/geometry-processing/next-job - Get next geometry processing record for external processing software
export async function GET(request: NextRequest) {
  try {
    // Track that the processor called in (for health monitoring)
    updateProcessorPing();
    // Try API key authentication first
    const apiAuth = await validateApiKey(request);
    
    if (apiAuth.success) {
      // Validate API key has required permission
      if (!checkApiPermission(apiAuth.apiKey, 'geometry-queue:read')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      console.log(`API key access: ${apiAuth.apiKey?.name} requesting next job`);
    } else {
      // Fall back to session authentication
      const session = await auth();
      
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Find the oldest unprocessed geometry processing queue entry
    // Include jobs that are either:
    // 1. Never started (ProcessStartedTime: null)
    // 2. Started but stuck (ProcessStartedTime set, but no ProcessCompletedTime and older than 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    const nextJob = await prisma.geometryProcessingQueue.findFirst({
      where: {
        isEnabled: true,
        ProcessCompletedTime: null, // Not completed
        OR: [
          { ProcessStartedTime: null }, // Never started
          { ProcessStartedTime: { lt: tenMinutesAgo } } // Started but stuck (>10 min ago)
        ]
      },
      include: {
        geometry: {
          select: {
            GeometryName: true,
            GeometryAlgorithmName: true,
            GeometryInputParameterSchema: true
          }
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        owningOrganization: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        CreationTime: 'asc'
      }
    });

    if (!nextJob) {
      return NextResponse.json({ 
        message: 'No jobs available for processing' 
      }, { status: 404 });
    }

    // Log whether this is a retry of a stuck job
    if (nextJob.ProcessStartedTime) {
      console.log(`Retrying stuck geometry job ${nextJob.id} (${nextJob.geometry.GeometryName}) - originally started at ${nextJob.ProcessStartedTime}`);
    } else {
      console.log(`Fetching geometry job ${nextJob.id} (${nextJob.geometry.GeometryName})`);
    }

    // DON'T mark as started here - the processor will call the mark-started endpoint
    // This prevents race conditions where the job gets marked as started but the 
    // processor never receives it due to network issues
    
    // Prepare response - return the job without marking as started
    const response = NextResponse.json({
      id: nextJob.id,
      objectID: nextJob.objectID,
      GeometryID: nextJob.GeometryID,
      GeometryName: nextJob.geometry.GeometryName,
      GeometryAlgorithmName: nextJob.geometry.GeometryAlgorithmName,
      GeometryInputParameterSchema: nextJob.geometry.GeometryInputParameterSchema,
      GeometryInputParameterData: nextJob.GeometryInputParameterData,
      CustomerNote: nextJob.CustomerNote,
      CustomerID: nextJob.CustomerID,
      CreationTime: nextJob.CreationTime,
      ProcessStartedTime: nextJob.ProcessStartedTime,
      isDebugRequest: nextJob.isDebugRequest || false,
      // File metadata lives on geometry job; no binary returned here
      GeometryFileName: (nextJob as any).GeometryFileName ?? null,
      PrintFileName: (nextJob as any).PrintFileName ?? null,
      creator: nextJob.creator,
      owningOrganization: nextJob.owningOrganization
    });

    // For debug jobs, delete after returning data (fire and forget)
    if (nextJob.isDebugRequest) {
      // Delete any associated print queue entries first, then the job
      prisma.printQueue.deleteMany({
        where: { GeometryProcessingQueueID: nextJob.id }
      }).then(() => {
        return prisma.geometryProcessingQueue.delete({
          where: { id: nextJob.id }
        });
      }).then(() => {
        console.log(`Deleted debug job ${nextJob.id} after pickup`);
      }).catch((err) => {
        console.error(`Failed to delete debug job ${nextJob.id}:`, err);
      });
    }

    return response;

  } catch (error) {
    console.error('Error getting next geometry processing job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}