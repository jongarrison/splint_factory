import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET /api/api-keys/[id] - Get specific API key (SYSTEM_ADMIN only)
export async function GET(
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const apiKey = await prisma.apiKey.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        permissions: true,
        organizationId: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        createdBy: true,
        organization: {
          select: {
            name: true
          }
        },
        creator: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...apiKey,
      permissions: JSON.parse(apiKey.permissions)
    });
  } catch (error) {
    console.error('Error fetching API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/api-keys/[id] - Update API key (SYSTEM_ADMIN only)
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, permissions, organizationId, isActive } = body;

    // Validate input
    if (!name || !Array.isArray(permissions)) {
      return NextResponse.json({ error: 'Name and permissions are required' }, { status: 400 });
    }

    if (name.length > 250) {
      return NextResponse.json({ error: 'Name must be 250 characters or less' }, { status: 400 });
    }

    // Validate permissions format
    const validPermissions = permissions.every((perm: any) => 
      typeof perm === 'string' && perm.includes(':')
    );
    
    if (!validPermissions) {
      return NextResponse.json({ error: 'Invalid permissions format' }, { status: 400 });
    }

    // Validate organization exists if provided
    if (organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId }
      });
      
      if (!org) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
      }
    }

    // Check if API key exists
    const existingKey = await prisma.apiKey.findUnique({
      where: { id }
    });

    if (!existingKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Update API key
    const updatedApiKey = await prisma.apiKey.update({
      where: { id },
      data: {
        name,
        permissions: JSON.stringify(permissions),
        organizationId: organizationId || null,
        isActive: isActive !== undefined ? isActive : existingKey.isActive
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        organizationId: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        organization: {
          select: {
            name: true
          }
        }
      }
    });

    return NextResponse.json({
      ...updatedApiKey,
      permissions: JSON.parse(updatedApiKey.permissions)
    });

  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/api-keys/[id] - Delete (disable) API key (SYSTEM_ADMIN only)
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if API key exists
    const existingKey = await prisma.apiKey.findUnique({
      where: { id }
    });

    if (!existingKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Disable the API key (following additive approach - don't actually delete)
    const updatedApiKey = await prisma.apiKey.update({
      where: { id },
      data: {
        isActive: false
      },
      select: {
        id: true,
        name: true,
        isActive: true
      }
    });

    return NextResponse.json({ 
      message: 'API key disabled successfully',
      apiKey: updatedApiKey
    });

  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
