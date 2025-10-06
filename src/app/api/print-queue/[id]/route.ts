import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/print-queue/[id] - Get specific print queue entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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

    const printQueueEntry = await prisma.printQueue.findUnique({
      where: { id },
      include: {
        geometryProcessingQueue: {
          include: {
            geometry: { select: { GeometryName: true, GeometryAlgorithmName: true } },
            creator: { select: { id: true, name: true, email: true } },
            owningOrganization: { select: { name: true } }
          }
        }
      }
    });

    if (!printQueueEntry) {
      return NextResponse.json({ error: 'Print queue entry not found' }, { status: 404 });
    }

    // Verify user has access to this entry (same organization)
    if (printQueueEntry.geometryProcessingQueue.OwningOrganizationID !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Return without binary data unless specifically requested (files live on geometryProcessingQueue)
    const includeFiles = request.nextUrl.searchParams.get('includeFiles') === 'true';
    const gpq: any = (printQueueEntry as any).geometryProcessingQueue;
    const response = {
      ...printQueueEntry,
      GeometryFileName: gpq?.GeometryFileName ?? null,
      PrintFileName: gpq?.PrintFileName ?? null,
      GeometryFileContents: includeFiles && gpq?.GeometryFileContents
        ? gpq.GeometryFileContents.toString('base64')
        : (gpq?.GeometryFileContents ? '[Binary Data]' : null),
      PrintFileContents: includeFiles && gpq?.PrintFileContents
        ? gpq.PrintFileContents.toString('base64')
        : (gpq?.PrintFileContents ? '[Binary Data]' : null),
      hasGeometryFile: !!gpq?.GeometryFileContents,
      hasPrintFile: !!gpq?.PrintFileContents
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching print queue entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/print-queue/[id] - Update print queue entry
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

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

    // Check if entry exists and user has access
    const existingEntry = await prisma.printQueue.findUnique({
      where: { id },
      include: {
        geometryProcessingQueue: {
          select: {
            OwningOrganizationID: true
          }
        }
      }
    });

    if (!existingEntry) {
      return NextResponse.json({ error: 'Print queue entry not found' }, { status: 404 });
    }

    if (existingEntry.geometryProcessingQueue.OwningOrganizationID !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      PrintStartedTime,
      PrintCompletedTime,
      isPrintSuccessful,
      printNote,
      isEnabled,
      GeometryFileContents,
      GeometryFileName,
      PrintFileContents,
      PrintFileName
    } = body;

    // Validate file size limits if files are being updated
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    
    if (GeometryFileContents) {
      const geometryBuffer = Buffer.from(GeometryFileContents, 'base64');
      if (geometryBuffer.length > maxFileSize) {
        return NextResponse.json({ 
          error: 'Geometry file exceeds 10MB limit' 
        }, { status: 400 });
      }
    }
    
    if (PrintFileContents) {
      const printBuffer = Buffer.from(PrintFileContents, 'base64');
      if (printBuffer.length > maxFileSize) {
        return NextResponse.json({ 
          error: 'Print file exceeds 10MB limit' 
        }, { status: 400 });
      }
    }

    // Prepare update data - only include fields that are provided
    const updateData: any = {};
    
    if (PrintStartedTime !== undefined) {
      updateData.PrintStartedTime = PrintStartedTime ? new Date(PrintStartedTime) : null;
    }
    
    if (PrintCompletedTime !== undefined) {
      updateData.PrintCompletedTime = PrintCompletedTime ? new Date(PrintCompletedTime) : null;
    }
    
    if (isPrintSuccessful !== undefined) {
      updateData.isPrintSuccessful = isPrintSuccessful;
    }
    
    if (printNote !== undefined) {
      updateData.printNote = printNote;
    }
    
    if (isEnabled !== undefined) {
      updateData.isEnabled = isEnabled;
    }
    
    if (GeometryFileContents !== undefined) {
      updateData.GeometryFileContents = GeometryFileContents ? Buffer.from(GeometryFileContents, 'base64') : null;
    }
    
    if (GeometryFileName !== undefined) {
      updateData.GeometryFileName = GeometryFileName;
    }
    
    if (PrintFileContents !== undefined) {
      updateData.PrintFileContents = PrintFileContents ? Buffer.from(PrintFileContents, 'base64') : null;
    }
    
    if (PrintFileName !== undefined) {
      updateData.PrintFileName = PrintFileName;
    }

    const updatedEntry = await prisma.printQueue.update({
      where: { id },
      data: updateData,
      include: {
        geometryProcessingQueue: {
          include: {
            geometry: {
              select: {
                GeometryName: true,
                GeometryAlgorithmName: true
              }
            }
          }
        }
      }
    });

    console.log(`Updated print queue entry ${id} by user ${session.user.id}`);
    
    // Return without binary data
    const response = {
      ...updatedEntry,
      GeometryFileContents: updatedEntry.GeometryFileContents ? '[Binary Data]' : null,
      PrintFileContents: updatedEntry.PrintFileContents ? '[Binary Data]' : null,
      hasGeometryFile: !!updatedEntry.GeometryFileContents,
      hasPrintFile: !!updatedEntry.PrintFileContents
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error updating print queue entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}