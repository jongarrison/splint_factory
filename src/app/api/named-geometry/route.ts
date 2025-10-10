import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GeometryInputParameterSchema } from '@/types/geometry-input-parameter';
import { INPUT_NAME_PATTERN, INPUT_NAME_ALLOWED_CHARS } from '@/constants/validation';

// GET /api/named-geometry - List all named geometries (accessible to all authenticated users)
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const namedGeometries = await prisma.namedGeometry.findMany({
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        CreationTime: 'desc'
      }
    });

    return NextResponse.json(namedGeometries);
  } catch (error) {
    console.error('Error fetching named geometries:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/named-geometry - Create new named geometry (SYSTEM_ADMIN only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is SYSTEM_ADMIN
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - SYSTEM_ADMIN access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { GeometryName, GeometryAlgorithmName, GeometryInputParameterSchema } = body;

    // Validate required fields
    if (!GeometryName || !GeometryAlgorithmName || !GeometryInputParameterSchema) {
      return NextResponse.json(
        { error: 'Missing required fields: GeometryName, GeometryAlgorithmName, GeometryInputParameterSchema' },
        { status: 400 }
      );
    }

    // Validate GeometryName length
    if (GeometryName.length > 250) {
      return NextResponse.json(
        { error: 'GeometryName must be 250 characters or less' },
        { status: 400 }
      );
    }

    // Validate GeometryAlgorithmName (no spaces allowed)
    if (GeometryAlgorithmName.includes(' ')) {
      return NextResponse.json(
        { error: 'GeometryAlgorithmName cannot contain spaces' },
        { status: 400 }
      );
    }

    // Validate GeometryInputParameterSchema is valid JSON and conforms to schema
    let parsedSchema: GeometryInputParameterSchema;
    try {
      parsedSchema = JSON.parse(GeometryInputParameterSchema);
      
      // Basic validation - should be an array
      if (!Array.isArray(parsedSchema)) {
        throw new Error('Schema must be an array');
      }

      // Validate each parameter in the schema
      for (const param of parsedSchema) {
        if (!param.InputName || !param.InputDescription || !param.InputType) {
          throw new Error('Each parameter must have InputName, InputDescription, and InputType');
        }
        
        // Validate InputName pattern
        if (!INPUT_NAME_PATTERN.test(param.InputName)) {
          throw new Error(`InputName "${param.InputName}" must contain only ${INPUT_NAME_ALLOWED_CHARS}`);
        }

        // Validate InputType
        if (!['Float', 'Integer', 'Text'].includes(param.InputType)) {
          throw new Error(`Invalid InputType: ${param.InputType}`);
        }

        // Validate type-specific fields
        if (param.InputType === 'Text') {
          if (typeof param.TextMinLen !== 'number' || typeof param.TextMaxLen !== 'number') {
            throw new Error('Text parameters must have TextMinLen and TextMaxLen');
          }
          if (param.TextMaxLen < param.TextMinLen) {
            throw new Error('TextMaxLen must be >= TextMinLen');
          }
        } else if (param.InputType === 'Float' || param.InputType === 'Integer') {
          if (param.NumberMin !== undefined && param.NumberMax !== undefined) {
            if (param.NumberMax < param.NumberMin) {
              throw new Error('NumberMax must be >= NumberMin');
            }
          }
        }
      }
    } catch (parseError) {
      return NextResponse.json(
        { error: `Invalid GeometryInputParameterSchema: ${parseError}` },
        { status: 400 }
      );
    }

    const namedGeometry = await prisma.namedGeometry.create({
      data: {
        GeometryName,
        GeometryAlgorithmName,
        GeometryInputParameterSchema,
        CreatorID: session.user.id
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    console.log(`Created NamedGeometry: ${GeometryName} by user ${session.user.id}`);
    return NextResponse.json(namedGeometry, { status: 201 });
  } catch (error) {
    console.error('Error creating named geometry:', error);
    
    // Handle unique constraint violation
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A geometry with this name already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
