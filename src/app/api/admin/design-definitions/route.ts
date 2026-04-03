import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inputParameterSchema } from '@/types/design-input-parameter';
import { INPUT_NAME_PATTERN, INPUT_NAME_ALLOWED_CHARS } from '@/constants/validation';

// GET /api/admin/design-definitions - Full geometry data for admin list page
// Returns all fields including creator details, sorted by creation time
// Scoped to user's org visibility unless SYSTEM_ADMIN requests all via ?all=true
// For optimized user-facing listing, use /api/designs instead
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, role: true },
    });

    // ?all=true bypasses org filter (for admin pages like the org editor)
    const wantAll = request.nextUrl.searchParams.get('all') === 'true';
    const skipOrgFilter = wantAll && user?.role === 'SYSTEM_ADMIN';

    const where: Record<string, unknown> = {};
    if (!skipOrgFilter && user?.organizationId) {
      where.organizations = {
        some: { organizationId: user.organizationId },
      };
    }

    const namedGeometries = await prisma.design.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
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
        createdAt: 'desc'
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

// POST /api/admin/design-definitions - Create new named geometry with optional image uploads (SYSTEM_ADMIN only)
// Accepts multipart/form-data with previewImage and measurementImage files
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

    // Validate inputParameterSchema is valid JSON and conforms to schema
    let parsedSchema: inputParameterSchema;
    try {
      parsedSchema = JSON.parse(inputParameterSchema);
      
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

    const design = await prisma.design.create({
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
        }),
        creatorId: session.user.id
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

    console.log(`Created design definition: ${designName} by user ${session.user.id}`);
    return NextResponse.json(design, { status: 201 });
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
