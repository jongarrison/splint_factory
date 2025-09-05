import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

// GET /api/api-keys - List all API keys (SYSTEM_ADMIN only)
export async function GET() {
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

    const apiKeys = await prisma.apiKey.findMany({
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Parse permissions JSON for each key
    const formattedKeys = apiKeys.map((key: any) => ({
      ...key,
      permissions: JSON.parse(key.permissions)
    }));

    return NextResponse.json(formattedKeys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/api-keys - Create new API key (SYSTEM_ADMIN only)
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, permissions, organizationId } = body;

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

    // Generate API key (32 random bytes as hex)
    const apiKey = randomBytes(32).toString('hex');
    const keyHash = await bcrypt.hash(apiKey, 12);

    // Create API key record
    const newApiKey = await prisma.apiKey.create({
      data: {
        name,
        keyHash,
        permissions: JSON.stringify(permissions),
        organizationId: organizationId || null,
        createdBy: session.user.id
      },
      select: {
        id: true,
        name: true,
        permissions: true,
        organizationId: true,
        isActive: true,
        createdAt: true,
        organization: {
          select: {
            name: true
          }
        }
      }
    });

    // Return the new key with the plain text API key (only time it's shown)
    return NextResponse.json({
      ...newApiKey,
      permissions: JSON.parse(newApiKey.permissions),
      apiKey // This is the only time the plain text key is returned
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
