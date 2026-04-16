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
      designJob: {
        owningOrganizationId: user.organizationId
      }
    };

    // Add geometry job filter if provided
    if (geometryJobId) {
      whereClause.designJobId = geometryJobId;
    }

    const printQueue = await prisma.printJob.findMany({
      where: whereClause,
      select: {
        // Print Queue fields
        id: true,
        createdAt: true,
        printStartedAt: true,
        printCompletedAt: true,
        isPrintSuccessful: true,
        printNote: true,
        printAcceptance: true,
        progress: true,
        progressLastReportAt: true,
        // Nested geometry processing queue - ONLY fields needed for list view
        designJob: {
          select: {
            id: true, // Required for print operations
            objectId: true,
            jobLabel: true,
            jobNote: true,
            meshFileName: true,
            printFileName: true,
            createdAt: true, // Required for sorting
            // Exclude: inputParameters, processStartedAt, processCompletedAt
            // Exclude: meshFileContents, printFileContents (CRITICAL - these are huge binary files)
            design: {
              select: {
                name: true,
                algorithmName: true
              }
            },
            creator: {
              select: {
                name: true
              }
            }
            // Exclude: owningOrganization (not displayed in list)
          }
        }
      },
      orderBy: [
        { isPrintSuccessful: 'asc' }, // Show unsuccessful first
        { printStartedAt: { sort: 'asc', nulls: 'first' } } // Then by start time, nulls first
      ]
    });

    // Format response - add convenience flags for file existence
    // Note: We're already excluding binary file contents in the select above (CRITICAL optimization)
    const formattedQueue = printQueue.map(item => {
      const gpq = item.designJob;
      return {
        ...item,
        meshFileName: gpq?.meshFileName ?? null,
        printFileName: gpq?.printFileName ?? null,
        // Note: We can't check file existence anymore since we excluded the binary fields
        // This is intentional - files are managed separately, use filename presence as proxy
        hasGeometryFile: !!gpq?.meshFileName,
        hasPrintFile: !!gpq?.printFileName
      };
    });

    const response = NextResponse.json(formattedQueue);

    // If request came from a known device, check for approved auth challenges
    const deviceId = request.headers.get('x-device-id');
    if (deviceId) {
      const approvedChallenge = await prisma.clientAuthChallenge.findFirst({
        where: {
          deviceId,
          authorizedAt: { not: null },
          exchangedAt: null, // not yet consumed
          expiresAt: { gt: new Date() },
        },
        include: {
          authorizedBy: { select: { id: true, name: true } },
        },
        orderBy: { authorizedAt: 'desc' },
      });

      if (approvedChallenge?.authorizedBy) {
        response.headers.set('X-Device-Auth-Status', 'challenge-approved');
        response.headers.set('X-Device-Auth-Challenge-Id', approvedChallenge.id);
        response.headers.set('X-Device-Auth-User', approvedChallenge.authorizedBy.name || '');
      }

      // Update device lastSeenAt
      await prisma.clientDevice.update({
        where: { id: deviceId },
        data: { lastSeenAt: new Date() },
      }).catch(() => {}); // non-critical, don't fail the request
    }

    return response;
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
      designJobId,
      meshFileContents,
      meshFileName,
      printFileContents,
      printFileName
    } = body;

    // Validate required fields
    if (!designJobId) {
      return NextResponse.json({ 
        error: 'designJobId is required' 
      }, { status: 400 });
    }

    // Validate that geometry processing queue entry exists and user has access
    const geometryJob = await prisma.designJob.findUnique({
      where: { id: designJobId },
      include: {
        owningOrganization: {
          select: { id: true }
        }
      }
    });

    if (!geometryJob) {
      return NextResponse.json({ error: 'Geometry processing queue entry not found' }, { status: 404 });
    }

    // Reject if processing failed or has no print file
    if (!geometryJob.isProcessSuccessful) {
      return NextResponse.json({ error: 'Cannot create print job for a failed geometry processing job' }, { status: 400 });
    }
    if (!geometryJob.printFileName && !printFileName) {
      return NextResponse.json({ error: 'Cannot create print job without a print file' }, { status: 400 });
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
    if (meshFileContents) {
      const geometryBuffer = Buffer.from(meshFileContents, 'base64');
      if (geometryBuffer.length > maxFileSize) {
        return NextResponse.json({ error: 'Geometry file exceeds 10MB limit' }, { status: 400 });
      }
    }
    if (printFileContents) {
      const printBuffer = Buffer.from(printFileContents, 'base64');
      if (printBuffer.length > maxFileSize) {
        return NextResponse.json({ error: 'Print file exceeds 10MB limit' }, { status: 400 });
      }
    }

    // In the new model, files are stored on the DesignJob.
    // If files are provided here, persist them to the DesignJob first, then create a PrintJob entry.
    const result = await prisma.$transaction(async (tx) => {
      if (meshFileContents || printFileContents || meshFileName || printFileName) {
        await tx.designJob.update({
          where: { id: designJobId },
          data: ({
            ...(meshFileContents !== undefined ? { meshFileContents: meshFileContents ? Buffer.from(meshFileContents, 'base64') : null } : {}),
            ...(meshFileName !== undefined ? { meshFileName: meshFileName || null } : {}),
            ...(printFileContents !== undefined ? { printFileContents: printFileContents ? Buffer.from(printFileContents, 'base64') : null } : {}),
            ...(printFileName !== undefined ? { printFileName: printFileName || null } : {})
          }) as any
        });
      }

      const created = await tx.printJob.create({
        data: { designJobId },
        include: { designJob: true }
      });

      return created;
    });

  console.log(`Created print queue entry for geometry processing job ${designJobId}`);
    
    // Return without binary data in response
    const gpq: any = (result as any).designJob;
    const response = {
      ...result,
      meshFileName: gpq?.meshFileName ?? null,
      printFileName: gpq?.printFileName ?? null,
      hasGeometryFile: !!gpq?.meshFileContents,
      hasPrintFile: !!gpq?.printFileContents,
      meshFileContents: undefined,
      printFileContents: undefined
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Error creating print queue entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}