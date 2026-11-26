import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';
import {
  DISABLED_PRINT_AUTO_ARCHIVE_HOURS,
  MAX_PRINT_AUTO_ARCHIVE_HOURS,
  MIN_PRINT_AUTO_ARCHIVE_HOURS,
} from '@/lib/print-auto-archive';

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
    const {
      name,
      description,
      isActive,
      screenLockTimeoutMinutes,
      printAutoArchiveHours,
    } = body;

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

    if (printAutoArchiveHours !== undefined) {
      const hours = Number(printAutoArchiveHours);
      if (
        !Number.isInteger(hours) ||
        (
          hours !== DISABLED_PRINT_AUTO_ARCHIVE_HOURS &&
          (hours < MIN_PRINT_AUTO_ARCHIVE_HOURS || hours > MAX_PRINT_AUTO_ARCHIVE_HOURS)
        )
      ) {
        return NextResponse.json(
          {
            error: `Print auto-archive interval must be -1 (disabled) or between ${MIN_PRINT_AUTO_ARCHIVE_HOURS} and ${MAX_PRINT_AUTO_ARCHIVE_HOURS} hours`,
          },
          { status: 400 },
        );
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
        ...(printAutoArchiveHours !== undefined && { printAutoArchiveHours: Number(printAutoArchiveHours) }),
      },
      include: { _count: { select: { users: true } } },
    });

    if (
      printAutoArchiveHours !== undefined &&
      Number(printAutoArchiveHours) !== existing.printAutoArchiveHours
    ) {
      logAuditEvent({
        eventType: 'PRINT_AUTO_ARCHIVE_SETTINGS_CHANGED',
        channel: 'PRINTING',
        actorId: session.user.id,
        organizationId: id,
        metadata: {
          previousHours: existing.printAutoArchiveHours,
          newHours: Number(printAutoArchiveHours),
        },
      });
    }

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
