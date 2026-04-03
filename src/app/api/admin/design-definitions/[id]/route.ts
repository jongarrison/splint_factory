import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inputParameterSchema } from '@/types/design-input-parameter';
import { INPUT_NAME_PATTERN, INPUT_NAME_ALLOWED_CHARS } from '@/constants/validation';

// GET /api/admin/design-definitions/[id] - Get specific named geometry
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

    const design = await prisma.design.findUnique({
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

    if (!design) {
      return NextResponse.json({ error: 'Named geometry not found' }, { status: 404 });
    }

    return NextResponse.json(design);
  } catch (error) {
    console.error('Error fetching named geometry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/design-definitions/[id] - Update named geometry with optional image uploads (SYSTEM_ADMIN only)
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
    const existingGeometry = await prisma.design.findUnique({
      where: { id }
    });

    if (!existingGeometry) {
      return NextResponse.json({ error: 'Named geometry not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const designName = formData.get('designName') as string;
    const algorithmName = formData.get('algorithmName') as string;
    const inputParameterSchema = formData.get('inputParameterSchema') as string;
    const shortDescription = formData.get('shortDescription') as string || null;
    const isActive = formData.get('isActive') === 'true';
    const previewImageFile = formData.get('previewImage') as File | null;
    const measurementImageFile = formData.get('measurementImage') as File | null;

    // Validate required fields
    if (!designName || !algorithmName || !inputParameterSchema) {
      return NextResponse.json(
        { error: 'Missing required fields: name, algorithmName, inputParameterSchema' },
        { status: 400 }
      );
    }

    // Validate designName.length
    if (designName.length > 250) {
      return NextResponse.json(
        { error: 'Design name must be 250 characters or less' },
        { status: 400 }
      );
    }

    // Validate algorithmName (no spaces allowed)
    if (algorithmName.includes(' ')) {
      return NextResponse.json(
        { error: 'algorithmName cannot contain spaces' },
        { status: 400 }
      );
    }

    // Validate inputParameterSchema
    let parsedSchema: inputParameterSchema;
    try {
      parsedSchema = JSON.parse(inputParameterSchema);
      
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
        { error: `Invalid inputParameterSchema: ${parseError}` },
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

    const updatedGeometry = await prisma.design.update({
      where: { id },
      data: {
        name: designName,
        algorithmName,
        inputParameterSchema,
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

    console.log(`Updated design definition: ${designName} by user ${session.user.id}`);
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

// PATCH /api/admin/design-definitions/[id] - Update schema only (SYSTEM_ADMIN only)
// Accepts JSON body: { inputParameterSchema: string }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (user?.role !== 'SYSTEM_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - SYSTEM_ADMIN access required' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.design.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Named geometry not found' }, { status: 404 });
    }

    const body = await request.json();
    const schema = body.inputParameterSchema;
    if (typeof schema !== 'string') {
      return NextResponse.json(
        { error: 'inputParameterSchema must be a JSON string' },
        { status: 400 }
      );
    }

    // Validate the schema
    let parsedSchema: inputParameterSchema;
    try {
      parsedSchema = JSON.parse(schema);
      if (!Array.isArray(parsedSchema)) {
        throw new Error('Schema must be an array');
      }
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
      }
    } catch (parseError) {
      return NextResponse.json(
        { error: `Invalid schema: ${parseError}` },
        { status: 400 }
      );
    }

    const updated = await prisma.design.update({
      where: { id },
      data: { inputParameterSchema: schema },
      select: { id: true, name: true, inputParameterSchema: true },
    });

    console.log(`Updated schema for design "${updated.name}" by user ${session.user.id}`);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error patching named geometry schema:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/design-definitions/[id] - Delete named geometry (SYSTEM_ADMIN only)
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
    const existingGeometry = await prisma.design.findUnique({
      where: { id }
    });

    if (!existingGeometry) {
      return NextResponse.json({ error: 'Named geometry not found' }, { status: 404 });
    }

    await prisma.design.delete({
      where: { id }
    });

    console.log(`Deleted design definition: ${existingGeometry.name} by user ${session.user.id}`);
    return NextResponse.json({ message: 'Named geometry deleted successfully' });
  } catch (error) {
    console.error('Error deleting named geometry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
