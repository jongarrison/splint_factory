import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateApiKey, checkApiPermission } from '@/lib/api-auth';

// GET /api/geometry-processing/next-job - Get next geometry processing record for external processing software
export async function GET(request: NextRequest) {
  try {
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
    const nextJob = await prisma.geometryProcessingQueue.findFirst({
      where: {
        ProcessStartedTime: null,
        isEnabled: true
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

    // Set ProcessStartedTime to now to mark as started
    const updatedJob = await prisma.geometryProcessingQueue.update({
      where: { id: nextJob.id },
      data: {
        ProcessStartedTime: new Date()
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
      }
    });

    console.log(`Started processing geometry job ${updatedJob.id} (${updatedJob.geometry.GeometryName})`);
    
    return NextResponse.json({
      id: updatedJob.id,
      GeometryID: updatedJob.GeometryID,
      GeometryName: updatedJob.geometry.GeometryName,
      GeometryAlgorithmName: updatedJob.geometry.GeometryAlgorithmName,
      GeometryInputParameterSchema: updatedJob.geometry.GeometryInputParameterSchema,
      GeometryInputParameterData: updatedJob.GeometryInputParameterData,
      CustomerNote: updatedJob.CustomerNote,
      CustomerID: updatedJob.CustomerID,
      CreationTime: updatedJob.CreationTime,
      ProcessStartedTime: updatedJob.ProcessStartedTime,
      // File metadata lives on geometry job; no binary returned here
      GeometryFileName: (updatedJob as any).GeometryFileName ?? null,
      PrintFileName: (updatedJob as any).PrintFileName ?? null,
      creator: updatedJob.creator,
      owningOrganization: updatedJob.owningOrganization
    });

  } catch (error) {
    console.error('Error getting next geometry processing job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}