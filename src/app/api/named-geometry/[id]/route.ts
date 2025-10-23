import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GeometryInputParameterSchema } from '@/types/geometry-input-parameter';
import { INPUT_NAME_PATTERN, INPUT_NAME_ALLOWED_CHARS } from '@/constants/validation';

// GET /api/named-geometry/[id] - Get specific named geometry
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

    const namedGeometry = await prisma.namedGeometry.findUnique({
      where: { id },
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

    if (!namedGeometry) {
      return NextResponse.json({ error: 'Named geometry not found' }, { status: 404 });
    }

    return NextResponse.json(namedGeometry);
  } catch (error) {
    console.error('Error fetching named geometry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/named-geometry/[id] - Update named geometry with optional image uploads (SYSTEM_ADMIN only)
// Accepts multipart/form-data with previewImage and measurementImage files
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Check if geometry exists
    const existingGeometry = await prisma.namedGeometry.findUnique({
      where: { id }
    });

    if (!existingGeometry) {
      return NextResponse.json({ error: 'Named geometry not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const GeometryName = formData.get('GeometryName') as string;
    const GeometryAlgorithmName = formData.get('GeometryAlgorithmName') as string;
    const GeometryInputParameterSchema = formData.get('GeometryInputParameterSchema') as string;
    const shortDescription = formData.get('shortDescription') as string || null;
    const isActive = formData.get('isActive') === 'true';
    const previewImageFile = formData.get('previewImage') as File | null;
    const measurementImageFile = formData.get('measurementImage') as File | null;

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

    // Validate GeometryInputParameterSchema
    let parsedSchema: GeometryInputParameterSchema;
    try {
      parsedSchema = JSON.parse(GeometryInputParameterSchema);
      
      if (!Array.isArray(parsedSchema)) {
        throw new Error('Schema must be an array');
      }

      // Validate each parameter in the schema
      for (const param of parsedSchema) {
        if (!param.InputName || !param.InputDescription || !param.InputType) {
          throw new Error('Each parameter must have InputName, InputDescription, and InputType');
        }
        
        if (!INPUT_NAME_PATTERN.test(param.InputName)) {
          throw new Error(`InputName "${param.InputName}" must contain only ${INPUT_NAME_ALLOWED_CHARS}`);
        }

        if (!['Float', 'Integer', 'Text'].includes(param.InputType)) {
          throw new Error(`Invalid InputType: ${param.InputType}`);
        }

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

    // Process images if provided
    let previewImageData: { image: Buffer; contentType: string } | null = null;
    let measurementImageData: { image: Buffer; contentType: string } | null = null;
    
    if (previewImageFile) {
      const arrayBuffer = await previewImageFile.arrayBuffer();
      previewImageData = {
        image: Buffer.from(arrayBuffer),
        contentType: previewImageFile.type
      };
    }
    
    if (measurementImageFile) {
      const arrayBuffer = await measurementImageFile.arrayBuffer();
      measurementImageData = {
        image: Buffer.from(arrayBuffer),
        contentType: measurementImageFile.type
      };
    }

    const updatedGeometry = await prisma.namedGeometry.update({
      where: { id },
      data: {
        GeometryName,
        GeometryAlgorithmName,
        GeometryInputParameterSchema,
        shortDescription,
        isActive,
        ...(previewImageData && {
          previewImage: previewImageData.image,
          previewImageContentType: previewImageData.contentType,
          previewImageUpdatedAt: new Date()
        }),
        ...(measurementImageData && {
          measurementImage: measurementImageData.image,
          measurementImageContentType: measurementImageData.contentType,
          measurementImageUpdatedAt: new Date()
        })
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

    console.log(`Updated NamedGeometry: ${GeometryName} by user ${session.user.id}`);
    return NextResponse.json(updatedGeometry);
  } catch (error) {
    console.error('Error updating named geometry:', error);
    
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

// DELETE /api/named-geometry/[id] - Delete named geometry (SYSTEM_ADMIN only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Check if geometry exists
    const existingGeometry = await prisma.namedGeometry.findUnique({
      where: { id }
    });

    if (!existingGeometry) {
      return NextResponse.json({ error: 'Named geometry not found' }, { status: 404 });
    }

    await prisma.namedGeometry.delete({
      where: { id }
    });

    console.log(`Deleted NamedGeometry: ${existingGeometry.GeometryName} by user ${session.user.id}`);
    return NextResponse.json({ message: 'Named geometry deleted successfully' });
  } catch (error) {
    console.error('Error deleting named geometry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
