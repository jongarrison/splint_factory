import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/geometry-jobs - List geometry processing queue entries for user's organization
export async function GET() {
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

    const geometryJobs = await prisma.geometryProcessingQueue.findMany({
      where: {
        OwningOrganizationID: user.organizationId
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
      },
      orderBy: {
        CreationTime: 'desc'
      }
    });

    return NextResponse.json(geometryJobs);
  } catch (error) {
    console.error('Error fetching geometry jobs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/geometry-jobs - Create new geometry processing job
export async function POST(request: NextRequest) {
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

    // Validate field lengths per requirements
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
      
      // Basic validation that required parameters are present
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
        
        // Type validation
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

    const geometryJob = await prisma.geometryProcessingQueue.create({
      data: {
        GeometryID,
        CreatorID: session.user.id,
        OwningOrganizationID: user.organizationId,
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

    console.log(`Created geometry processing job for ${geometryJob.geometry.GeometryName} by user ${session.user.id}`);
    return NextResponse.json(geometryJob, { status: 201 });

  } catch (error) {
    console.error('Error creating geometry job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}