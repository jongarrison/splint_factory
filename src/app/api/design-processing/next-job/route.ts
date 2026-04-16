import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateApiKey, checkApiPermission } from '@/lib/api-auth';
import { updateProcessorPing } from '@/lib/geo-processor-health';
import { getDesignById } from '@/designs/registry';

// GET /api/design-processing/next-job - Get next geometry processing record for external processing software
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
    // 1. Never started (processStartedAt: null)
    // 2. Started but stuck (processStartedAt set, but no processCompletedAt and older than 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    const nextJob = await prisma.designJob.findFirst({
      where: {
        isEnabled: true,
        processCompletedAt: null, // Not completed
        OR: [
          { processStartedAt: null }, // Never started
          { processStartedAt: { lt: tenMinutesAgo } } // Started but stuck (>10 min ago)
        ]
      },
      include: {
        design: {
          select: {
            name: true,
            algorithmName: true,
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
        createdAt: 'asc'
      }
    });

    if (!nextJob) {
      return NextResponse.json({ 
        message: 'No jobs available for processing' 
      }, { status: 404 });
    }

    // Log whether this is a retry of a stuck job
    if (nextJob.processStartedAt) {
      console.log(`Retrying stuck geometry job ${nextJob.id} (${nextJob.design.name}) - originally started at ${nextJob.processStartedAt}`);
    } else {
      console.log(`Fetching geometry job ${nextJob.id} (${nextJob.design.name})`);
    }

    // DON'T mark as started here - the processor will call the mark-started endpoint
    // This prevents race conditions where the job gets marked as started but the 
    // processor never receives it due to network issues
    
    // Get inputParameterSchema from code registry
    const registryDesign = getDesignById(nextJob.designId);

    // Prepare response - return the job without marking as started
    const response = NextResponse.json({
      id: nextJob.id,
      objectId: nextJob.objectId,
      designId: nextJob.designId,
      name: nextJob.design.name,
      algorithmName: nextJob.design.algorithmName,
      inputParameterSchema: registryDesign ? JSON.stringify(registryDesign.inputParameters) : '[]',
      inputParameters: nextJob.inputParameters,
      jobNote: nextJob.jobNote,
      jobLabel: nextJob.jobLabel,
      createdAt: nextJob.createdAt,
      processStartedAt: nextJob.processStartedAt,
      // File metadata lives on geometry job; no binary returned here
      meshFileName: (nextJob as any).meshFileName ?? null,
      printFileName: (nextJob as any).printFileName ?? null,
      creator: nextJob.creator,
      owningOrganization: nextJob.owningOrganization
    });

    return response;

  } catch (error) {
    console.error('Error getting next geometry processing job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}