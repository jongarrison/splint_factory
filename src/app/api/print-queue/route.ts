import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// GET /api/print-queue - List print queue entries for user's organization
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with organization
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        organizationId: true,
        role: true 
      }
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'User must be part of an organization' }, { status: 403 });
    }

    // Check for optional geometry job ID filter
    const { searchParams } = new URL(request.url);
    const geometryJobId = searchParams.get('geometryJobId');

    // Build where clause
    const whereClause: any = {
      isEnabled: true, // Only show enabled (non-deleted) entries
      geometryProcessingQueue: {
        OwningOrganizationID: user.organizationId
      }
    };

    // Add geometry job filter if provided
    if (geometryJobId) {
      whereClause.GeometryProcessingQueueID = geometryJobId;
    }

    const printQueue = await prisma.printQueue.findMany({
      where: whereClause,
      select: {
        // Print Queue fields
        id: true,
        PrintStartedTime: true,
        PrintCompletedTime: true,
        isPrintSuccessful: true,
        printNote: true,
        printAcceptance: true,
        progress: true,
        progressLastReportTime: true,
        // Nested geometry processing queue - ONLY fields needed for list view
        geometryProcessingQueue: {
          select: {
            id: true, // Required for print operations
            CustomerID: true,
            CustomerNote: true,
            GeometryFileName: true,
            PrintFileName: true,
            // Exclude: CreationTime, GeometryInputParameterData, ProcessStartedTime, ProcessCompletedTime
            // Exclude: GeometryFileContents, PrintFileContents (CRITICAL - these are huge binary files)
            geometry: {
              select: {
                GeometryName: true,
                GeometryAlgorithmName: true
              }
            }
            // Exclude: creator, owningOrganization (not displayed in list)
          }
        }
      },
      orderBy: [
        { isPrintSuccessful: 'asc' }, // Show unsuccessful first
        { PrintStartedTime: { sort: 'asc', nulls: 'first' } } // Then by start time, nulls first
      ]
    });

    // Format response - add convenience flags for file existence
    // Note: We're already excluding binary file contents in the select above (CRITICAL optimization)
    const formattedQueue = printQueue.map(item => {
      const gpq = item.geometryProcessingQueue;
      return {
        ...item,
        GeometryFileName: gpq?.GeometryFileName ?? null,
        PrintFileName: gpq?.PrintFileName ?? null,
        // Note: We can't check file existence anymore since we excluded the binary fields
        // This is intentional - files are managed separately, use filename presence as proxy
        hasGeometryFile: !!gpq?.GeometryFileName,
        hasPrintFile: !!gpq?.PrintFileName
      };
    });

    return NextResponse.json(formattedQueue);
  } catch (error) {
    console.error('Error fetching print queue:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/print-queue - Create new print queue entry (typically used by geometry processing software)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      GeometryProcessingQueueID,
      GeometryFileContents,
      GeometryFileName,
      PrintFileContents,
      PrintFileName
    } = body;

    // Validate required fields
    if (!GeometryProcessingQueueID) {
      return NextResponse.json({ 
        error: 'GeometryProcessingQueueID is required' 
      }, { status: 400 });
    }

    // Validate that geometry processing queue entry exists and user has access
    const geometryJob = await prisma.geometryProcessingQueue.findUnique({
      where: { id: GeometryProcessingQueueID },
      include: {
        owningOrganization: {
          select: { id: true }
        }
      }
    });

    if (!geometryJob) {
      return NextResponse.json({ error: 'Geometry processing queue entry not found' }, { status: 404 });
    }

    // Get user organization to verify access
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        organizationId: true,
        role: true 
      }
    });

    // For regular users, ensure they're part of the same organization
    // For API keys, this would be handled by API authentication middleware
    if (user?.organizationId !== geometryJob.owningOrganization.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Validate file size limits (10MB as specified in requirements) if files are provided.
    const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
    if (GeometryFileContents) {
      const geometryBuffer = Buffer.from(GeometryFileContents, 'base64');
      if (geometryBuffer.length > maxFileSize) {
        return NextResponse.json({ error: 'Geometry file exceeds 10MB limit' }, { status: 400 });
      }
    }
    if (PrintFileContents) {
      const printBuffer = Buffer.from(PrintFileContents, 'base64');
      if (printBuffer.length > maxFileSize) {
        return NextResponse.json({ error: 'Print file exceeds 10MB limit' }, { status: 400 });
      }
    }

    // In the new model, files are stored on the GeometryProcessingQueue.
    // If files are provided here, persist them to the GeometryProcessingQueue first, then create a PrintQueue entry.
    const result = await prisma.$transaction(async (tx) => {
      if (GeometryFileContents || PrintFileContents || GeometryFileName || PrintFileName) {
        await tx.geometryProcessingQueue.update({
          where: { id: GeometryProcessingQueueID },
          data: ({
            ...(GeometryFileContents !== undefined ? { GeometryFileContents: GeometryFileContents ? Buffer.from(GeometryFileContents, 'base64') : null } : {}),
            ...(GeometryFileName !== undefined ? { GeometryFileName: GeometryFileName || null } : {}),
            ...(PrintFileContents !== undefined ? { PrintFileContents: PrintFileContents ? Buffer.from(PrintFileContents, 'base64') : null } : {}),
            ...(PrintFileName !== undefined ? { PrintFileName: PrintFileName || null } : {})
          }) as any
        });
      }

      const created = await tx.printQueue.create({
        data: { GeometryProcessingQueueID },
        include: { geometryProcessingQueue: true }
      });

      return created;
    });

  console.log(`Created print queue entry for geometry processing job ${GeometryProcessingQueueID}`);
    
    // Return without binary data in response
    const gpq: any = (result as any).geometryProcessingQueue;
    const response = {
      ...result,
      GeometryFileName: gpq?.GeometryFileName ?? null,
      PrintFileName: gpq?.PrintFileName ?? null,
      hasGeometryFile: !!gpq?.GeometryFileContents,
      hasPrintFile: !!gpq?.PrintFileContents,
      GeometryFileContents: undefined,
      PrintFileContents: undefined
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Error creating print queue entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}