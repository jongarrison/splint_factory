import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/geometry-jobs/[id] - Get specific geometry processing job
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

    const geometryJob = await prisma.geometryProcessingQueue.findUnique({
      where: { id },
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
            name: true
          }
        }
      }
    });

    if (!geometryJob) {
      return NextResponse.json({ error: 'Geometry job not found' }, { status: 404 });
    }

    // Verify user has access to this job (same organization)
    if (geometryJob.OwningOrganizationID !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json(geometryJob);
  } catch (error) {
    console.error('Error fetching geometry job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/geometry-jobs/[id] - Update geometry processing job
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

    // Check if job exists and user has access
    const existingJob = await prisma.geometryProcessingQueue.findUnique({
      where: { id },
      select: {
        OwningOrganizationID: true,
        GeometryID: true
      }
    });

    if (!existingJob) {
      return NextResponse.json({ error: 'Geometry job not found' }, { status: 404 });
    }

    if (existingJob.OwningOrganizationID !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      GeometryID, 
      GeometryInputParameterData, 
      CustomerNote, 
      CustomerID,
      isEnabled 
    } = body;

    // Validate required fields
    if (!GeometryID || !GeometryInputParameterData) {
      return NextResponse.json({ 
        error: 'GeometryID and GeometryInputParameterData are required' 
      }, { status: 400 });
    }

    // Validate field lengths
    if (CustomerNote && CustomerNote.length > 500) {
      return NextResponse.json({ 
        error: 'CustomerNote must be 500 characters or less' 
      }, { status: 400 });
    }

    if (CustomerID && CustomerID.length > 20) {
      return NextResponse.json({ 
        error: 'CustomerID must be 20 characters or less' 
      }, { status: 400 });
    }

    // Validate that geometry exists
    const geometry = await prisma.namedGeometry.findUnique({
      where: { id: GeometryID },
      select: { 
        id: true,
        GeometryInputParameterSchema: true 
      }
    });

    if (!geometry) {
      return NextResponse.json({ error: 'Geometry not found' }, { status: 404 });
    }

    // Validate GeometryInputParameterData against schema
    try {
      const schema = JSON.parse(geometry.GeometryInputParameterSchema);
      const inputData = JSON.parse(GeometryInputParameterData);
      
      if (!Array.isArray(schema)) {
        throw new Error('Invalid geometry schema format');
      }
      
      if (typeof inputData !== 'object') {
        throw new Error('GeometryInputParameterData must be a JSON object');
      }

      // Validate each required parameter is provided
      for (const param of schema) {
        if (!(param.InputName in inputData)) {
          throw new Error(`Missing required parameter: ${param.InputName}`);
        }

        const value = inputData[param.InputName];
        
        // Type and range validation
        if (param.InputType === 'Float') {
          if (typeof value !== 'number') {
            throw new Error(`Parameter ${param.InputName} must be a number`);
          }
          if (param.NumberMin !== undefined && value < param.NumberMin) {
            throw new Error(`Parameter ${param.InputName} must be >= ${param.NumberMin}`);
          }
          if (param.NumberMax !== undefined && value > param.NumberMax) {
            throw new Error(`Parameter ${param.InputName} must be <= ${param.NumberMax}`);
          }
        } else if (param.InputType === 'Integer') {
          if (!Number.isInteger(value)) {
            throw new Error(`Parameter ${param.InputName} must be an integer`);
          }
          if (param.NumberMin !== undefined && value < param.NumberMin) {
            throw new Error(`Parameter ${param.InputName} must be >= ${param.NumberMin}`);
          }
          if (param.NumberMax !== undefined && value > param.NumberMax) {
            throw new Error(`Parameter ${param.InputName} must be <= ${param.NumberMax}`);
          }
        } else if (param.InputType === 'Text') {
          if (typeof value !== 'string') {
            throw new Error(`Parameter ${param.InputName} must be a string`);
          }
          if (param.TextMinLen !== undefined && value.length < param.TextMinLen) {
            throw new Error(`Parameter ${param.InputName} must be at least ${param.TextMinLen} characters`);
          }
          if (param.TextMaxLen !== undefined && value.length > param.TextMaxLen) {
            throw new Error(`Parameter ${param.InputName} must be no more than ${param.TextMaxLen} characters`);
          }
        }
      }
    } catch (validationError) {
      return NextResponse.json({ 
        error: `Invalid geometry input parameters: ${validationError}` 
      }, { status: 400 });
    }

    const updatedJob = await prisma.geometryProcessingQueue.update({
      where: { id },
      data: {
        GeometryID,
        GeometryInputParameterData,
        CustomerNote: CustomerNote || null,
        CustomerID: CustomerID || null,
        isEnabled: isEnabled !== undefined ? isEnabled : true
      },
      include: {
        geometry: {
          select: {
            GeometryName: true,
            GeometryAlgorithmName: true
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
            name: true
          }
        }
      }
    });

    console.log(`Updated geometry processing job ${id} by user ${session.user.id}`);
    return NextResponse.json(updatedJob);

  } catch (error) {
    console.error('Error updating geometry job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/geometry-jobs/[id] - Disable geometry processing job (following additive approach)
export async function DELETE(
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

    // Check if job exists and user has access
    const existingJob = await prisma.geometryProcessingQueue.findUnique({
      where: { id },
      select: {
        OwningOrganizationID: true
      }
    });

    if (!existingJob) {
      return NextResponse.json({ error: 'Geometry job not found' }, { status: 404 });
    }

    if (existingJob.OwningOrganizationID !== user.organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Disable the job instead of deleting (following additive approach)
    const updatedJob = await prisma.geometryProcessingQueue.update({
      where: { id },
      data: {
        isEnabled: false
      },
      select: {
        id: true,
        isEnabled: true
      }
    });

    console.log(`Disabled geometry processing job ${id} by user ${session.user.id}`);
    return NextResponse.json({ 
      message: 'Geometry processing job disabled successfully',
      job: updatedJob
    });

  } catch (error) {
    console.error('Error disabling geometry job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}