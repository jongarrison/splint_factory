import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateObjectId } from '@/lib/objectId';

// GET /api/design-jobs - List geometry processing queue entries for user's organization
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

    const geometryJobs = await prisma.designJob.findMany({
      where: {
        owningOrganizationId: user.organizationId
      },
      select: {
        // Only fields actually used in the list view
        id: true,
        createdAt: true,
        jobLabel: true,
        jobNote: true,
        objectId: true,
        processStartedAt: true,
        processCompletedAt: true,
        isProcessSuccessful: true,
        isEnabled: true,
        isDebugRequest: true,
        // Exclude: inputParameters (can be large JSON)
        // Exclude: meshFileContents, printFileContents (CRITICAL - huge binary files)
        // Exclude: meshFileName, printFileName, processingLog (not shown in list)
        design: {
          select: {
            name: true,
            algorithmName: true
          }
        },
        creator: {
          select: {
            name: true
            // Exclude: id, email (not displayed in list)
          }
        },
        printJobs: {
          select: {
            id: true,
            printAcceptance: true
          }
        }
        // Exclude: owningOrganization (not displayed in list)
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(geometryJobs);
  } catch (error) {
    console.error('Error fetching geometry jobs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/design-jobs - Create new geometry processing job
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
      designId, 
      inputParameters, 
      jobNote, 
      jobLabel,
      isEnabled 
    } = body;

    // Validate required fields
    if (!designId || !inputParameters) {
      return NextResponse.json({ 
        error: 'designId and inputParameters are required' 
      }, { status: 400 });
    }

    // Validate field lengths per requirements
    if (jobNote && jobNote.length > 500) {
      return NextResponse.json({ 
        error: 'Job Note must be 500 characters or less' 
      }, { status: 400 });
    }

    if (jobLabel && jobLabel.length > 20) {
      return NextResponse.json({ 
        error: 'Job Label must be 20 characters or less' 
      }, { status: 400 });
    }

    // Validate that geometry exists
    const design = await prisma.design.findUnique({
      where: { id: designId },
      select: { 
        id: true,
        inputParameterSchema: true 
      }
    });

    if (!design) {
      return NextResponse.json({ error: 'Geometry not found' }, { status: 404 });
    }

    // Validate inputParameters against schema
    try {
      const schema = JSON.parse(design.inputParameterSchema);
      const inputData = JSON.parse(inputParameters);
      
      // Basic validation that required parameters are present
      if (!Array.isArray(schema)) {
        throw new Error('Invalid geometry schema format');
      }
      
      if (typeof inputData !== 'object') {
        throw new Error('inputParameters must be a JSON object');
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

    // Generate unique objectId
    const objectId = await generateObjectId();

    const geometryJob = await prisma.designJob.create({
      data: {
        designId,
        creatorId: session.user.id,
        owningOrganizationId: user.organizationId,
        inputParameters,
        jobNote: jobNote || null,
        jobLabel: jobLabel || null,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        objectId,
        objectIdGeneratedAt: new Date()
      },
      include: {
        design: {
          select: {
            name: true,
            algorithmName: true
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

    console.log(`Created geometry processing job for ${geometryJob.design.name} by user ${session.user.id}`);
    return NextResponse.json(geometryJob, { status: 201 });

  } catch (error) {
    console.error('Error creating geometry job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}