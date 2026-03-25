import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/organizations/[id] - Get organization details (any member of this org, or SYSTEM_ADMIN)
export async function GET(
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
      select: { role: true, organizationId: true },
    });

    const { id } = await params;

    const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';
    const isOrgMember = user?.organizationId === id;
    if (!isSystemAdmin && !isOrgMember) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/organizations/[id] - Update organization details (SYSTEM_ADMIN or ORG_ADMIN of this org)
export async function PUT(
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
      select: { role: true, organizationId: true },
    });

    const { id } = await params;

    const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';
    const isOrgAdmin = user?.role === 'ORG_ADMIN' && user?.organizationId === id;
    if (!isSystemAdmin && !isOrgAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, isActive, screenLockTimeoutMinutes } = body;

    if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }

    // Validate screenLockTimeoutMinutes if provided
    if (screenLockTimeoutMinutes !== undefined) {
      const timeout = Number(screenLockTimeoutMinutes);
      if (!Number.isInteger(timeout) || timeout < 1 || timeout > 480) {
        return NextResponse.json({ error: 'Screen lock timeout must be between 1 and 480 minutes' }, { status: 400 });
      }
    }

    const existing = await prisma.organization.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
        ...(screenLockTimeoutMinutes !== undefined && { screenLockTimeoutMinutes: Number(screenLockTimeoutMinutes) }),
      },
      include: { _count: { select: { users: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating organization:', error);
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Organization name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
