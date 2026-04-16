import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDesignById } from '@/designs/registry';

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

    const printQueueEntry = await prisma.printJob.findUnique({
      where: { id },
      include: {
        designJob: {
          include: {
            design: { select: { name: true, algorithmName: true } },
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
    if (printQueueEntry.designJob.owningOrganizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Enrich design with inputParameterSchema from code registry
    const registryDesign = getDesignById(printQueueEntry.designJob.designId);

    // Return without binary data unless specifically requested (files live on geometryProcessingQueue)
    const includeFiles = request.nextUrl.searchParams.get('includeFiles') === 'true';
    const gpq: any = (printQueueEntry as any).designJob;

    // Inject inputParameterSchema into the design object
    const enrichedEntry = {
      ...printQueueEntry,
      designJob: {
        ...printQueueEntry.designJob,
        design: {
          ...printQueueEntry.designJob.design,
          inputParameterSchema: registryDesign ? JSON.stringify(registryDesign.inputParameters) : '[]',
        },
      },
    };

    const response = {
      ...enrichedEntry,
      meshFileName: gpq?.meshFileName ?? null,
      printFileName: gpq?.printFileName ?? null,
      meshFileContents: includeFiles && gpq?.meshFileContents
        ? gpq.meshFileContents.toString('base64')
        : (gpq?.meshFileContents ? '[Binary Data]' : null),
      printFileContents: includeFiles && gpq?.printFileContents
        ? gpq.printFileContents.toString('base64')
        : (gpq?.printFileContents ? '[Binary Data]' : null),
      hasGeometryFile: !!gpq?.meshFileContents,
      hasPrintFile: !!gpq?.printFileContents
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
    const existingEntry = await prisma.printJob.findUnique({
      where: { id },
      include: {
        designJob: {
          select: {
            owningOrganizationId: true
          }
        }
      }
    });

    if (!existingEntry) {
      return NextResponse.json({ error: 'Print queue entry not found' }, { status: 404 });
    }

    if (existingEntry.designJob.owningOrganizationId !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      printStartedAt,
      printCompletedAt,
      isPrintSuccessful,
      printNote,
      isEnabled,
      meshFileContents,
      meshFileName,
      printFileContents,
      printFileName
    } = body;

    // Validate file size limits if files are being updated
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    
    if (meshFileContents) {
      const geometryBuffer = Buffer.from(meshFileContents, 'base64');
      if (geometryBuffer.length > maxFileSize) {
        return NextResponse.json({ 
          error: 'Geometry file exceeds 10MB limit' 
        }, { status: 400 });
      }
    }
    
    if (printFileContents) {
      const printBuffer = Buffer.from(printFileContents, 'base64');
      if (printBuffer.length > maxFileSize) {
        return NextResponse.json({ 
          error: 'Print file exceeds 10MB limit' 
        }, { status: 400 });
      }
    }

    // Prepare update data - only include fields that are provided
    const updateData: any = {};
    
    if (printStartedAt !== undefined) {
      updateData.printStartedAt = printStartedAt ? new Date(printStartedAt) : null;
      // Track who started the print
      if (printStartedAt) {
        updateData.printedByUserId = session.user.id;
      }
    }
    
    if (printCompletedAt !== undefined) {
      updateData.printCompletedAt = printCompletedAt ? new Date(printCompletedAt) : null;
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
    
    if (meshFileContents !== undefined) {
      updateData.meshFileContents = meshFileContents ? Buffer.from(meshFileContents, 'base64') : null;
    }
    
    if (meshFileName !== undefined) {
      updateData.meshFileName = meshFileName;
    }
    
    if (printFileContents !== undefined) {
      updateData.printFileContents = printFileContents ? Buffer.from(printFileContents, 'base64') : null;
    }
    
    if (printFileName !== undefined) {
      updateData.printFileName = printFileName;
    }

    const updatedEntry = await prisma.printJob.update({
      where: { id },
      data: updateData,
      include: {
        designJob: {
          include: {
            design: {
              select: {
                name: true,
                algorithmName: true
              }
            }
          }
        }
      }
    });

    console.log(`Updated print queue entry ${id} by user ${session.user.id}`);
    
    // Return without binary data
    const gpqUpdate: any = (updatedEntry as any).designJob;
    const response = {
      ...updatedEntry,
      meshFileContents: gpqUpdate?.meshFileContents ? '[Binary Data]' : null,
      printFileContents: gpqUpdate?.printFileContents ? '[Binary Data]' : null,
      hasGeometryFile: !!gpqUpdate?.meshFileContents,
      hasPrintFile: !!gpqUpdate?.printFileContents
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error updating print queue entry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}